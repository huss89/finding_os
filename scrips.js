// Global variables - declare at the top
let cvReady = false;
let videoReady = false;
let cameraStream = null;
let detectionRunning = false;
let currentFacingMode = 'environment'; // Start with rear camera

// Performance tracking
let frameCount = 0;
let fpsStartTime = Date.now();

// Detection parameters
let detectionParams = {
    param1: 100,
    param2: 30,
    minRadius: 5,
    maxRadius: 100
};

// DOM elements - will be initialized when DOM is ready
let videoElement, canvas, ctx, statusElement, cameraBtn, debugElement;
let param1Slider, param2Slider, minRadiusSlider, maxRadiusSlider, resetBtn;
let param1Value, param2Value, minRadiusValue, maxRadiusValue;
let fpsCounter, processingTime;

// This function MUST be global and available immediately
function onOpenCvReady() {
    console.log("onOpenCvReady called - OpenCV.js is loading...");
    cv['onRuntimeInitialized'] = () => {
        console.log("OpenCV.js is ready!");
        cvReady = true;
        if (statusElement) {
            statusElement.innerText = 'OpenCV is ready.';
        }
        setupSliders();
        startApp();
    };
}

// Initialize DOM elements
function initializeElements() {
    console.log("Initializing DOM elements...");
    
    // Get references to our HTML elements
    videoElement = document.getElementById('video-feed');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    statusElement = document.getElementById('status');
    cameraBtn = document.getElementById('camera-btn');
    debugElement = document.getElementById('debug');

    // Slider elements
    param1Slider = document.getElementById('param1-slider');
    param2Slider = document.getElementById('param2-slider');
    minRadiusSlider = document.getElementById('min-radius-slider');
    maxRadiusSlider = document.getElementById('max-radius-slider');
    resetBtn = document.getElementById('reset-params');

    // Value display elements
    param1Value = document.getElementById('param1-value');
    param2Value = document.getElementById('param2-value');
    minRadiusValue = document.getElementById('min-radius-value');
    maxRadiusValue = document.getElementById('max-radius-value');

    // Performance tracking
    fpsCounter = document.getElementById('fps-counter');
    processingTime = document.getElementById('processing-time');
    
    // Camera switch button
    const switchCameraBtn = document.getElementById('switch-camera');
    if (switchCameraBtn) {
        switchCameraBtn.addEventListener('click', switchCamera);
        // Hide button if not mobile
        if (!('mediaDevices' in navigator && 'enumerateDevices' in navigator.mediaDevices)) {
            switchCameraBtn.style.display = 'none';
        }
    }
    
    console.log("DOM elements initialized");
}

// Setup slider event listeners
function setupSliders() {
    console.log("Setting up sliders...");
    
    if (!param1Slider) {
        console.log("Sliders not ready yet, waiting...");
        return;
    }
    
    // Update param1 (edge detection threshold)
    param1Slider.addEventListener('input', (e) => {
        detectionParams.param1 = parseInt(e.target.value);
        param1Value.textContent = detectionParams.param1;
        console.log("Updated param1:", detectionParams.param1);
    });

    // Update param2 (accumulation threshold)
    param2Slider.addEventListener('input', (e) => {
        detectionParams.param2 = parseInt(e.target.value);
        param2Value.textContent = detectionParams.param2;
        console.log("Updated param2:", detectionParams.param2);
    });

    // Update min radius
    minRadiusSlider.addEventListener('input', (e) => {
        detectionParams.minRadius = parseInt(e.target.value);
        minRadiusValue.textContent = detectionParams.minRadius;
        
        // Ensure min radius is less than max radius
        if (detectionParams.minRadius >= detectionParams.maxRadius) {
            detectionParams.maxRadius = detectionParams.minRadius + 10;
            maxRadiusSlider.value = detectionParams.maxRadius;
            maxRadiusValue.textContent = detectionParams.maxRadius;
        }
        console.log("Updated minRadius:", detectionParams.minRadius);
    });

    // Update max radius
    maxRadiusSlider.addEventListener('input', (e) => {
        detectionParams.maxRadius = parseInt(e.target.value);
        maxRadiusValue.textContent = detectionParams.maxRadius;
        
        // Ensure max radius is greater than min radius
        if (detectionParams.maxRadius <= detectionParams.minRadius) {
            detectionParams.minRadius = detectionParams.maxRadius - 10;
            minRadiusSlider.value = Math.max(1, detectionParams.minRadius);
            minRadiusValue.textContent = Math.max(1, detectionParams.minRadius);
        }
        console.log("Updated maxRadius:", detectionParams.maxRadius);
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        detectionParams = { param1: 100, param2: 30, minRadius: 5, maxRadius: 100 };
        
        param1Slider.value = detectionParams.param1;
        param2Slider.value = detectionParams.param2;
        minRadiusSlider.value = detectionParams.minRadius;
        maxRadiusSlider.value = detectionParams.maxRadius;
        
        param1Value.textContent = detectionParams.param1;
        param2Value.textContent = detectionParams.param2;
        minRadiusValue.textContent = detectionParams.minRadius;
        maxRadiusValue.textContent = detectionParams.maxRadius;
        
        console.log("Reset parameters to defaults");
    });
    
    console.log("Sliders setup complete");
}

// Check if we're on HTTPS or localhost
function checkSecureContext() {
    const isSecure = location.protocol === 'https:' || 
                    location.hostname === 'localhost' || 
                    location.hostname === '127.0.0.1';
    
    if (debugElement) {
        debugElement.textContent = `Protocol: ${location.protocol}, Secure: ${isSecure}`;
    }
    
    if (!isSecure) {
        if (statusElement) {
            statusElement.innerText = 'Camera requires HTTPS or localhost';
        }
        return false;
    }
    return true;
}

// Check camera permissions
async function checkCameraPermissions() {
    try {
        if (!navigator.permissions) {
            console.log("Permissions API not supported");
            return 'unknown';
        }
        
        const permission = await navigator.permissions.query({ name: 'camera' });
        console.log("Camera permission status:", permission.state);
        return permission.state;
    } catch (err) {
        console.log("Could not check camera permissions:", err);
        return 'unknown';
    }
}

// Main function to set everything up
async function setup() {
    console.log("Setup starting...");
    
    // Check if we're in a secure context
    if (!checkSecureContext()) {
        return;
    }
    
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusElement) {
            statusElement.innerText = 'Camera API not supported in this browser';
        }
        return;
    }
    
    // Check camera permissions first
    const permissionStatus = await checkCameraPermissions();
    console.log("Permission status:", permissionStatus);
    
    if (permissionStatus === 'denied') {
        if (statusElement) {
            statusElement.innerText = 'Camera permission denied. Please enable in browser settings.';
        }
        showCameraButton();
        return;
    }
    
    if (statusElement) {
        statusElement.innerText = 'Requesting camera access...';
    }
    await startCamera();
}

// Show camera button for manual permission request
function showCameraButton() {
    if (cameraBtn) {
        cameraBtn.style.display = 'inline-block';
        cameraBtn.onclick = async () => {
            cameraBtn.style.display = 'none';
            if (statusElement) {
                statusElement.innerText = 'Requesting camera access...';
            }
            await startCamera();
        };
    }
}

// A single starting point that waits for both OpenCV and the video
function startApp() {
    console.log("StartApp called - CV ready:", cvReady, "Video ready:", videoReady);
    
    // Only start the detection loop if both OpenCV and the video are fully ready.
    if (cvReady && videoReady && !detectionRunning) {
        console.log("Starting detection loop...");
        if (statusElement) {
            statusElement.innerText = 'Starting detection...';
        }
        detectionRunning = true;
        
        // Ensure video is visible
        if (videoElement) {
            videoElement.style.display = 'block';
        }
        
        // Start the detection loop
        detectCircles();
    } else {
        console.log("Not ready yet - CV:", cvReady, "Video:", videoReady, "Already running:", detectionRunning);
    }
}

// Function to start the camera with enhanced error handling
async function startCamera() {
    try {
        console.log("Attempting to start camera...");
        
        // First check if any camera is available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        
        if (cameras.length === 0) {
            throw new Error('No cameras found on this device');
        }

        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        console.log("Requesting camera with constraints:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Camera access granted");
        
        cameraStream = stream;
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';
        
        // Wait for video to be ready
        videoElement.onloadedmetadata = () => {
            console.log("Video metadata loaded");
            console.log("Video dimensions:", videoElement.videoWidth, "x", videoElement.videoHeight);
            
            // Set canvas size to match video
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            console.log("Canvas dimensions set to:", canvas.width, "x", canvas.height);
            
            videoReady = true;
            if (statusElement) {
                statusElement.innerText = 'Camera ready.';
            }
            
            // Try to start the app now that video is ready
            startApp();
        };
        
        videoElement.onerror = (err) => {
            console.error("Video error:", err);
        };

        // Start playing
        await videoElement.play();
        console.log("Video started playing");
        
    } catch (err) {
        console.error("Detailed camera error:", err);
        
        let errorMessage = "Camera Error: ";
        switch (err.name) {
            case 'NotAllowedError':
                errorMessage += "Permission denied. Please allow camera access.";
                showCameraButton();
                break;
            case 'NotFoundError':
                errorMessage += "No camera found.";
                break;
            case 'NotReadableError':
                errorMessage += "Camera is being used by another application.";
                break;
            default:
                errorMessage += `${err.name} - ${err.message}`;
        }
        
        if (statusElement) {
            statusElement.innerText = errorMessage;
        }
    }
}

// Add this function after the startCamera function
async function switchCamera() {
    console.log("Switching camera...");
    try {
        // Stop current camera stream if it exists
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        // Toggle facing mode
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        console.log("New facing mode:", currentFacingMode);

        // Reset video readiness
        videoReady = false;

        // Request new camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        // Update stream and start video
        cameraStream = stream;
        videoElement.srcObject = stream;
        videoElement.style.display = 'block';

        // Wait for video to be ready
        await videoElement.play();
        
        // Update canvas size once new video is loaded
        videoElement.onloadedmetadata = () => {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            videoReady = true;
            startApp();
        };

        if (statusElement) {
            statusElement.innerText = `Switched to ${currentFacingMode === 'user' ? 'front' : 'rear'} camera`;
        }

    } catch (err) {
        console.error("Error switching camera:", err);
        if (statusElement) {
            statusElement.innerText = `Failed to switch camera: ${err.message}`;
        }
    }
}

// Calculate and update FPS
function updateFPS() {
    frameCount++;
    const now = Date.now();
    const elapsed = now - fpsStartTime;
    
    if (elapsed >= 1000) { // Update every second
        const fps = Math.round((frameCount * 1000) / elapsed);
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${fps}`;
        }
        frameCount = 0;
        fpsStartTime = now;
    }
}

// The AI Loop: Detects circles in the video feed
function detectCircles() {
    if (!cvReady || !videoReady || !videoElement || videoElement.paused || videoElement.ended) {
        requestAnimationFrame(detectCircles);
        return;
    }

    const startTime = performance.now();
    
    let src = null;
    let gray = null;
    let circles = null;

    try {
        // Clear canvas and draw current video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Create OpenCV matrices
        src = cv.imread(canvas);
        gray = new cv.Mat();
        circles = new cv.Mat();
        
        // Image processing
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.medianBlur(gray, gray, 5);
        
        // Circle detection with current slider parameters
        const minDist = Math.max(gray.rows / 16, detectionParams.minRadius * 2);
        
        cv.HoughCircles(
            gray,
            circles,
            cv.HOUGH_GRADIENT,
            1,  // dp
            minDist,  // minDist
            detectionParams.param1,  // param1 - edge detection threshold
            detectionParams.param2,  // param2 - accumulation threshold
            detectionParams.minRadius,   // minRadius
            detectionParams.maxRadius    // maxRadius
        );

        // Update circle counter
        const circleCount = circles.cols;
        document.getElementById('circle-count').textContent = circleCount;
        
        // Draw detected circles
        if (circleCount > 0) {
            console.log(`Drawing ${circleCount} circles`);
            for (let i = 0; i < circleCount; ++i) {
                let x = circles.data32F[i * 3];
                let y = circles.data32F[i * 3 + 1];
                let radius = circles.data32F[i * 3 + 2];

                // Draw circle outline (green)
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.strokeStyle = '#00FF00';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw center point (red)
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#FF0000';
                ctx.fill();

                // Draw circle number
                ctx.fillStyle = '#FFFF00';
                ctx.font = '16px Arial';
                ctx.fillText(`${i + 1}`, x - 8, y - radius - 10);
            }
            if (statusElement) {
                statusElement.innerText = `Detecting circles... Found: ${circleCount}`;
            }
        } else {
            if (statusElement) {
                statusElement.innerText = "Searching for circles...";
            }
        }
        
    } catch(err) {
        console.error("Detection error:", err);
    } finally {
        // Safer cleanup with null checks
        if (src) src.delete();
        if (gray) gray.delete();
        if (circles) circles.delete();
    }

    requestAnimationFrame(detectCircles);
}

// Clean up camera stream when page unloads
window.addEventListener('beforeunload', () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }
});

// Wait for the entire page to load before trying to run our code
document.addEventListener('DOMContentLoaded', (event) => {
    console.log("DOM Content Loaded");
    initializeElements();
    // Kick off the setup process
    setup();
});
// Make onOpenCvReady globally available
window.onOpenCvReady = onOpenCvReady;