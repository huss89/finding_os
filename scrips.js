// Get references to our HTML elements
const videoElement = document.getElementById('video-feed');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');
const cannySlider = document.getElementById('cannySlider');
const accSlider = document.getElementById('accSlider');
const debugCheckbox = document.getElementById('debugCheckbox');

let cvReady = false;
let videoReady = false;

// This function is called by the "onload" attribute in the OpenCV script tag
function onOpenCvReady() {
    statusElement.innerText = 'OpenCV script loaded. Initializing...';
    cv['onRuntimeInitialized'] = () => {
        statusElement.innerText = 'OpenCV is ready.';
        cvReady = true;
        startApp();
    };
}

// Main function to set everything up
async function setup() {
    statusElement.innerText = 'Requesting camera access...';
    await startCamera();
    videoElement.addEventListener('loadeddata', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        videoReady = true;
        statusElement.innerText = 'Camera ready.';
        startApp();
    });
}

function startApp() {
    if (cvReady && videoReady) {
        statusElement.innerText = 'Starting detection...';
        requestAnimationFrame(detectCircles);
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
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
    if (!cvReady || !videoReady || videoElement.paused || videoElement.ended) {
        requestAnimationFrame(detectCircles);
        return;
    }

    let src = new cv.Mat(videoElement.videoHeight, videoElement.videoWidth, cv.CV_8UC4);
    let gray = new cv.Mat();
    let circles = new cv.Mat();
    let cap = new cv.VideoCapture(videoElement);

    try {
        cap.read(src);
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

        // --- Read live values from the sliders ---
        const cannyThreshold = parseInt(cannySlider.value);
        const accumulatorThreshold = parseInt(accSlider.value);

        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, 45, cannyThreshold, accumulatorThreshold, 10, 0);

        // --- Handle Debug View ---
        if (debugCheckbox.checked) {
            // If debug is on, show the processed grayscale image instead of the video
            cv.imshow('canvas', gray);
        } else {
            // Otherwise, clear the canvas for normal drawing
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        const circleCount = circles.cols;
        for (let i = 0; i < circleCount; ++i) {
            let x = circles.data32F[i * 3];
            let y = circles.data32F[i * 3 + 1];
            let radius = circles.data32F[i * 3 + 2];
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.lineWidth = 3;
            ctx.strokeStyle = debugCheckbox.checked ? '#FF0000' : '#00FF00'; // Red on debug, Green on normal
            ctx.stroke();
        }

        if (circleCount > 0) {
            statusElement.innerText = `Circles Detected: ${circleCount}`;
        } else {
            statusElement.innerText = "Searching for circles...";
        }

    } catch(err) {
        console.error("Error during circle detection:", err);
    } finally {
        src.delete();
        gray.delete();
        circles.delete();
    }

    requestAnimationFrame(detectCircles);
}

document.addEventListener('DOMContentLoaded', (event) => {
    setup();
});

