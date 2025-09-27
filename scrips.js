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
        console.log("Starting detection...");
        statusElement.innerText = 'Starting detection...';
        // Ensure video is visible
        videoElement.style.display = 'block';
        requestAnimationFrame(detectCircles);
    } else {
        console.log("Not ready yet - CV:", cvReady, "Video:", videoReady);
    }
}

// Function to start the camera
async function startCamera() {
    try {
        console.log("Attempting to start camera...");
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment'
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera access granted:", stream);
        
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                console.log("Video metadata loaded");
                resolve();
            };
            videoElement.onerror = (err) => {
                console.error("Video error:", err);
            };
        });

        // Start playing
        await videoElement.play();
        console.log("Video started playing");
        
    } catch (err) {
        console.error("Detailed camera error:", err);
        statusElement.innerText = `Camera Error: ${err.name} - ${err.message}`;
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

    try {
        // Capture current video frame to canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        // Read from canvas into OpenCV Mat
        src = cv.imread(canvas);

        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        
        // Improved blur parameters
        cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);

        // Adjusted circle detection parameters
        cv.HoughCircles(
            gray,           // input image
            circles,        // output array
            cv.HOUGH_GRADIENT, // detection method
            1,             // dp
            gray.rows/8,   // minDist
            100,           // param1
            30,            // param2
            20,            // minRadius
            100           // maxRadius
        );

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw video frame
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Draw detected circles
        for (let i = 0; circles.cols && i < circles.cols; ++i) {
            let x = circles.data32F[i * 3];
            let y = circles.data32F[i * 3 + 1];
            let radius = circles.data32F[i * 3 + 2];

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#00FF00';
            ctx.stroke();
        }

        statusElement.innerText = circles.cols ? `Circles Detected: ${circles.cols}` : "Searching for circles...";

    } catch(err) {
        console.error("Error during circle detection:", err);
        statusElement.innerText = "Error during detection: " + err.message;
    } finally {
        src.delete();
        gray.delete();
        circles.delete();
    }

    requestAnimationFrame(detectCircles);
}

// **NEW** - Wait for the entire page to load before trying to run our code
document.addEventListener('DOMContentLoaded', (event) => {
    // Kick off the setup process
    setup();
});

// Note: The OpenCV script tag in the HTML has an "onload" attribute that calls onOpenCvReady()