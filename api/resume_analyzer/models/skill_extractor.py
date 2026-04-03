import torch
import torch.nn as nn
from torchcrf import CRF

class SkillExtractor(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, num_tags):
        super().__init__()

        self.embedding = nn.Embedding(vocab_size, embed_dim)
        self.cnn = nn.Conv1d(embed_dim, 128, kernel_size=3, padding=1)

        self.lstm = nn.LSTM(
            128, hidden_dim // 2,
            bidirectional=True,
            batch_first=True
        )

        self.fc = nn.Linear(hidden_dim, num_tags)
        self.crf = CRF(num_tags)

    def forward(self, x, mask, tags=None):
        x = self.embedding(x)
        x = x.permute(0, 2, 1)

        x = torch.relu(self.cnn(x))
        x = x.permute(0, 2, 1)

        x, _ = self.lstm(x)

        emissions = self.fc(x)
        emissions = emissions.permute(1, 0, 2)

        mask = mask.permute(1, 0)

        if tags is not None:
            tags = tags.permute(1, 0)
            loss = -self.crf(emissions, tags, mask=mask.bool())
            return loss.mean()
        else:
            return self.crf.viterbi_decode(emissions, mask=mask.bool())