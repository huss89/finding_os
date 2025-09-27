// Get references to our HTML elements
const videoElement = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');

let cvReady = false;
let videoReady = false;

// This function is called by the "onload" attribute in the OpenCV script tag
function onOpenCvReady() {
    statusElement.innerText = 'OpenCV script loaded. Initializing...';
    // The 'cv' object is now available. onRuntimeInitialized fires when the WASM module is ready.
    cv['onRuntimeInitialized'] = () => {
        statusElement.innerText = 'OpenCV is ready.';
        cvReady = true;
        // Check if we can start the main app logic
        startApp();
    };
}

// Main function to set everything up
async function setup() {
    statusElement.innerText = 'Requesting camera access...';
    await startCamera();

    // This event fires once the video's dimensions are known.
    videoElement.addEventListener('loadeddata', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        videoReady = true;
        statusElement.innerText = 'Camera ready.';
        // Check if we can start the main app logic
        startApp();
    });
}

// A single starting point that waits for both OpenCV and the video
function startApp() {
    // Only start the detection loop if both OpenCV and the video are fully ready.
    if (cvReady && videoReady) {
        statusElement.innerText = 'Starting detection...';
        requestAnimationFrame(detectCircles);
    }
}


// Function to start the camera
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        // This promise resolves when the video's metadata has loaded.
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve();
        });
    } catch (err) {
        console.error("Error accessing the camera: ", err);
        statusElement.innerText = "Error: Could not access camera. Please grant permission.";
    }
}

// The AI Loop: Detects circles in the video feed
function detectCircles() {
    // Pre-conditions for the loop to run
    if (!cvReady || !videoReady || videoElement.paused || videoElement.ended) {
        requestAnimationFrame(detectCircles); // Keep checking
        return;
    }

    // Create OpenCV Mats (image containers).
    // Using a try...finally block ensures we always clean up memory.
    let src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
    let gray = new cv.Mat();
    let circles = new cv.Mat();
    let cap = new cv.VideoCapture(videoElement);

    try {
        // Read a frame from the video feed
        cap.read(src);

        // Convert the image to grayscale, which is better for circle detection
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Apply a blur to reduce noise and improve detection
        cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

        // Use Hough Circle Transform to find circles
        // Tweak these parameters for better detection:
        // (source, destination, method, dp, minDist, param1, param2, minRadius, maxRadius)
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, 45, 75, 40, 10, 0);

        // Clear the previous drawings from the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the detected circles onto the canvas
        const circleCount = circles.cols;
        for (let i = 0; i < circleCount; ++i) {
            let x = circles.data32F[i * 3];
            let y = circles.data32F[i * 3 + 1];
            let radius = circles.data32F[i * 3 + 2];

            // Circle outline
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#00FF00'; // Green
            ctx.stroke();
        }

        // Update the status message based on detection
        if (circleCount > 0) {
            statusElement.innerText = `Circles Detected: ${circleCount}`;
        } else {
            statusElement.innerText = "Searching for circles...";
        }

    } catch(err) {
        console.error("Error during circle detection:", err);
    } finally {
        // IMPORTANT: Clean up memory by deleting the Mats to prevent crashes
        src.delete();
        gray.delete();
        circles.delete();
    }

    // Run this function again on the next available frame
    requestAnimationFrame(detectCircles);
}

// **NEW** - Wait for the entire page to load before trying to run our code
document.addEventListener('DOMContentLoaded', (event) => {
    // Kick off the setup process
    setup();
});

