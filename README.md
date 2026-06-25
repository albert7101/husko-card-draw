# Hand Gesture Card Carousel

A browser-based 20-card carousel controlled with hand gestures.

## Features

- MediaPipe Hands webcam tracking
- Swing an open palm left or right to rotate through cards
- Fast swings create an infinite-looping picker-wheel spin that gradually slows
- Pinch thumb and index finger to flip the selected card
- 20 configurable cards
- Arrow-key and Space/Enter fallback
- Shift + Arrow simulates a fast momentum spin
- No backend required

## Run

Double-click `open-demo.bat`, keep its window open, and allow camera access in the browser.

To change card images, open `cards.js` and add image filenames to `frontImage` or `backImage`.
