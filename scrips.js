// Get a reference to the video element in our HTML
const videoElement = document.getElementById('video-feed');

// This function will start the camera stream
async function startCamera() {
  try {
    // Request access to the user's camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    // If access is granted, set the video element's source to the camera stream
    videoElement.srcObject = stream;
  } catch (err) {
    // If there's an error (e.g., user denies access), log it to the console
    console.error("Error accessing the camera: ", err);
    alert("Could not access the camera. Please ensure you have given permission.");
  }
}

// Call the function to start the camera when the page loads
startCamera();