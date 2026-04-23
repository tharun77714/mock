import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torchaudio
import torchaudio.transforms as T
import torch.nn.functional as F
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from tqdm import tqdm
import os

# Model architecture classes (redefined here for standalone use)
class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, pool=(2,2)):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(),
            nn.Conv2d(out_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(),
            nn.MaxPool2d(pool), nn.Dropout2d(0.2)
        )
    def forward(self, x): return self.conv(x)

class VoiceConfidenceModel(nn.Module):
    def __init__(self, num_emotions=6, prosodic_dim=13):
        super().__init__()
        self.cnn = nn.Sequential(
            ConvBlock(1,  32,  (2,2)),
            ConvBlock(32, 64,  (2,2)),
            ConvBlock(64, 128, (2,1)),
            ConvBlock(128,128, (2,1))
        )
        self.cnn_proj = nn.Sequential(nn.Linear(1024, 256), nn.LayerNorm(256), nn.ReLU())
        self.bilstm = nn.LSTM(256, 256, 2, batch_first=True, bidirectional=True, dropout=0.3)
        self.attention = nn.Sequential(nn.Linear(512, 64), nn.Tanh(), nn.Linear(64, 1))
        self.emotion_head = nn.Sequential(nn.Linear(512, 64), nn.ReLU(), nn.Linear(64, num_emotions))
        self.prosodic_enc = nn.Sequential(nn.Linear(prosodic_dim, 32), nn.ReLU(), nn.BatchNorm1d(32))
        self.blend = nn.Sequential(
            nn.Linear(num_emotions + 32, 64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, 1), nn.Sigmoid()
        )

    def forward(self, mel, prosodic):
        B = mel.shape[0]
        x = self.cnn(mel)
        x = x.permute(0, 3, 1, 2).reshape(B, 23, -1)
        x = self.cnn_proj(x)
        lstm_out, _ = self.bilstm(x)
        weights = torch.softmax(self.attention(lstm_out), dim=1)
        pooled  = (lstm_out * weights).sum(dim=1)
        emotion_logits = self.emotion_head(pooled)
        emotion_probs  = torch.softmax(emotion_logits, dim=1)
        pros = self.prosodic_enc(prosodic)
        blend_input = torch.cat([emotion_probs, pros], dim=1)
        confidence  = self.blend(blend_input).squeeze(-1)
        return {'emotion_logits': emotion_logits, 'confidence': confidence}

class AudioDataset(Dataset):
    def __init__(self, dataframe, prosodic_cols, augment=False):
        self.df = dataframe.reset_index(drop=True)
        self.prosodic_cols = prosodic_cols
        self.augment = augment
        self.mel_t = T.MelSpectrogram(sample_rate=16000, n_fft=1024, hop_length=512, n_mels=128)
        self.db_t = T.AmplitudeToDB()

    def __len__(self): return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        wav, sr = torchaudio.load(row['filepath'])
        if wav.shape[0] > 1: wav = wav.mean(dim=0, keepdim=True)
        if sr != 16000: wav = T.Resample(sr, 16000)(wav)
        
        target_len = 16000 * 3
        if wav.shape[1] >= target_len: wav = wav[:, :target_len]
        else: wav = F.pad(wav, (0, target_len - wav.shape[1]))
        
        mel = self.db_t(self.mel_t(wav))
        mel = (mel - mel.mean()) / (mel.std() + 1e-9)
        if mel.shape[2] > 94: mel = mel[:, :, :94]
        else: mel = F.pad(mel, (0, 94 - mel.shape[2]))
        
        prosodic = torch.tensor([float(row[c]) for c in self.prosodic_cols], dtype=torch.float32)
        return {
            'mel': mel,
            'prosodic': prosodic,
            'label': torch.tensor(int(row['label']), dtype=torch.long),
            'confidence': torch.tensor(float(row['confidence']), dtype=torch.float32)
        }

class BlendedLoss(nn.Module):
    def __init__(self, alpha=0.3):
        super().__init__()
        self.alpha = alpha
        self.ce = nn.CrossEntropyLoss()
        self.mse = nn.MSELoss()
    def forward(self, preds, targets):
        l_em = self.ce(preds['emotion_logits'], targets['label'])
        l_conf = self.mse(preds['confidence'], targets['confidence'])
        return self.alpha * l_em + (1.0 - self.alpha) * l_conf

def train_voice(df, save_path, epochs=25, alpha=0.3):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    train_df, val_df = train_test_split(df, test_size=0.15, stratify=df['label'])
    
    prosodic_cols = [c for c in df.columns if c.startswith('pitch_') or c.startswith('energy_') or c in ['jitter', 'shimmer', 'hnr', 'zcr_mean', 'silence_ratio', 'duration']]
    
    train_loader = DataLoader(AudioDataset(train_df, prosodic_cols, True), batch_size=32, shuffle=True)
    val_loader = DataLoader(AudioDataset(val_df, prosodic_cols, False), batch_size=32)
    
    model = VoiceConfidenceModel(num_emotions=df['label'].nunique(), prosodic_dim=len(prosodic_cols)).to(device)
    criterion = BlendedLoss(alpha).to(device)
    optimizer = optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    
    best_loss = float('inf')
    for epoch in range(epochs):
        model.train()
        for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}"):
            mel, pros, targets = batch['mel'].to(device), batch['prosodic'].to(device), {k: batch[k].to(device) for k in ['label', 'confidence']}
            optimizer.zero_grad()
            preds = model(mel, pros)
            loss = criterion(preds, targets)
            loss.backward()
            optimizer.step()
        scheduler.step()
        # Add simple val logic here...
