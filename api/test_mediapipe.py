import os
import sys

try:
    from main import L_EYE_LEFT_CORNER, L_EYE_RIGHT_CORNER, GAZE_TOLERANCE, LEFT_IRIS, RIGHT_IRIS, MPFaceMesh, MEDIAPIPE_OK
    print("Variables imported successfully!")
    print(f"LEFT_IRIS: {LEFT_IRIS}")
    print(f"L_EYE_LEFT_CORNER: {L_EYE_LEFT_CORNER}")
    print(f"MEDIAPIPE_OK: {MEDIAPIPE_OK}")
except Exception as e:
    print(f"Import Error: {e}")
