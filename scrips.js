// Get references to our HTML elements
const videoElement = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');

let model;

// Main function to set everything up
async function setup() {
  // 1. Start the camera feed
  await startCamera();

  // Set the canvas size to match the video feed
  videoElement.addEventListener('loadeddata', () => {
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
  });

  // 2. Load the COCO-SSD model
  statusElement.innerText = 'Loading Model...';
  model = await cocoSsd.load();
  statusElement.innerText = 'Model Loaded! Point your camera at an object.';

  // 3. Start the detection loop
  detectObjects();
}

// Function to start the camera
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    // We need to wait for the video to start playing to know its dimensions
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        resolve();
      };
    });
  } catch (err) {
    console.error("Error accessing the camera: ", err);
    alert("Could not access the camera. Please ensure you have given permission.");
  }
}

// Function to detect objects and draw on the canvas (The AI Loop)
async function detectObjects() {
  // Clear the previous drawings from the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Use the model to detect objects in the current video frame
  const predictions = await model.detect(videoElement);

  // Loop through each prediction
  predictions.forEach(prediction => {
    // prediction.bbox is [x, y, width, height]
    const [x, y, width, height] = prediction.bbox;
    const label = `${prediction.class}: ${Math.round(prediction.score * 100)}%`;

    // Set styling for the drawing
    ctx.strokeStyle = '#00FF00'; // Green color for the box
    ctx.lineWidth = 2;
    ctx.fillStyle = '#00FF00';
    ctx.font = '16px sans-serif';

    // Draw the bounding box
    ctx.strokeRect(x, y, width, height);
    // Draw the label
    ctx.fillText(label, x, y > 10 ? y - 5 : 10); // Don't let label go off-screen
  });

  // Run this function again on the next frame
  requestAnimationFrame(detectObjects);
}

// Start the whole process!
setup();