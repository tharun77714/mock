import sys
import os

from main import analyze_video_with_model

def run():
    # Find any webm in the uploads directory
    uploads_dir = "uploads"
    if not os.path.exists(uploads_dir):
        print("No uploads dir")
        return
        
    files = [f for f in os.listdir(uploads_dir) if f.endswith('.webm') or f.endswith('.mp4')]
    if not files:
        print("No video files found")
        return
        
    latest_file = max([os.path.join(uploads_dir, f) for f in files], key=os.path.getmtime)
    print(f"Testing video: {latest_file}")
    
    try:
        res = analyze_video_with_model(latest_file)
        print("Analysis success:")
        print(res)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run()
