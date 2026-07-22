# Piczzle 🧩📸

> An interactive, AI-powered webcam sliding puzzle game driven by real-time hand gesture tracking.

**🌐 Live Web Application**: [https://piczzle.ai.studio](https://piczzle.ai.studio)

Piczzle transforms your live camera feed into an interactive, real-time sliding puzzle! Frame your shot using natural hand gestures or dual-finger scaling, capture a snapshot after a 3-second pose countdown, and solve the 3x3 sliding tile puzzle by sliding pieces with hand gestures or touch/mouse controls.

---

## 🌐 Live Access

Experience the app directly in your web browser:
👉 **[https://piczzle.ai.studio](https://piczzle.ai.studio)**

*Note: Allow webcam permissions when prompted to enable AI hand gesture tracking.*

---

## ✨ Features

- **🎮 Dual Interactive Modes**:
  - **Camera Framing Mode**: Move and scale a square crop box seamlessly over your live webcam video stream.
  - **Puzzle Play Mode**: Slice the captured snapshot into a solvable 3x3 sliding puzzle grid with randomized tile shuffling.
- **✋ AI Hand Gesture Tracking**:
  - Powered by **MediaPipe Hand Landmarker** running client-side at high performance.
  - **1-Finger Pointing**: Drag and reposition the selection box by moving your index finger tip.
  - **2-Finger / Dual-Hand Framing**: Position two fingertips in front of the lens to anchor opposite corners and dynamically resize the frame.
  - **Gesture Tile Sliding**: Hover your index finger tip or pinch thumb & index finger over any adjacent tile to slide it into the blank space.
- **🎨 Visual Customization & Debugging**:
  - **Landmarks Overlay**: Toggle real-time skeleton landmark joint rendering and pinch distance visualization.
  - **Film Grain Filter**: Toggle a retro monochrome film grain aesthetic overlay.
  - **Dynamic Guidance**: Context-aware instruction banner providing live hand feedback.
- **🔊 Web Audio FX**:
  - Built-in synthesizer generating tactile sound effects for tile sliding, frame adjustments, countdown ticks, and victory celebration fanfares.
- **🏆 Victory & Statistics**:
  - Festive confetti burst upon puzzle completion, along with total moves counter, elapsed timer, and full restored photo view.

---

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS + Lucide Icons
- **Computer Vision**: `@mediapipe/tasks-vision` (HandLandmarker)
- **Audio Engine**: Custom Web Audio API Synthesizer
- **Effects**: `canvas-confetti`
- **Build Tool**: Vite

---

## 🎯 Controls & Gestures Guide

| Action | Hand Gesture |
| :--- | :--- |
| **Move Selection Frame** | Point index finger toward the screen |
| **Resize Frame** | Use index fingertips of two hands (or index + middle finger) to stretch frame |
| **Slide Tile** | Hover index finger tip or pinch (thumb + index) over adjacent tile |
| **Capture Photo** | Press "Create Puzzle from Selection" for 3-second pose countdown |

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

