// Get references to our HTML elements
const videoElement = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');

let isCvReady = false;

// This function is called by the "onload" attribute in the OpenCV script tag
function onOpenCvReady() {
    cv['onRuntimeInitialized'] = () => {
        statusElement.innerText = 'OpenCV is ready.';
        isCvReady = true;
        // Start the main setup process
        setup();
    };
}

// Main function to set everything up
async function setup() {
    // 1. Start the camera feed
    await startCamera();

    // Set the canvas size to match the video feed once it's loaded
    videoElement.addEventListener('loadeddata', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        // Start the detection loop
        requestAnimationFrame(detectCircles);
    });
}

// Function to start the camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve();
        });
    } catch (err) {
        console.error("Error accessing the camera: ", err);
        statusElement.innerText = "Error: Could not access the camera. Please grant permission.";
    }
}

// The AI Loop: Detects circles in the video feed
function detectCircles() {
    if (!isCvReady || videoElement.paused || videoElement.ended) {
        requestAnimationFrame(detectCircles);
        return;
    }

    // Create an OpenCV Mat (image container) from the video frame
    let src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
    let cap = new cv.VideoCapture(videoElement);
    cap.read(src);

    // Create a destination Mat for grayscale image
    let gray = new cv.Mat();
    // Convert the image to grayscale, which is better for circle detection
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Apply a blur to reduce noise and improve detection
    cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

    // Use Hough Circle Transform to find circles
    let circles = new cv.Mat();
    // Tweak these parameters for better detection:
    // (source, destination, method, dp, minDist, param1, param2, minRadius, maxRadius)
    cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, 45, 75, 40, 10, 0);

    // Clear the previous drawings from the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the detected circles onto the canvas
    for (let i = 0; i < circles.cols; ++i) {
        let x = circles.data32F[i * 3];
        let y = circles.data32F[i * 3 + 1];
        let radius = circles.data32F[i * 3 + 2];

        // Circle outline
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00FF00'; // Green
        ctx.stroke();

        // Add a status message
        statusElement.innerText = `Circles Detected: ${circles.cols}`;
    }
    
    if (circles.cols === 0) {
        statusElement.innerText = "Searching for circles...";
    }

    // Clean up memory
    src.delete();
    gray.delete();
    circles.delete();

    // Run this function again on the next frame
    requestAnimationFrame(detectCircles);
}

