### 🎭 Background Processing
- **Real-time background removal** using MediaPipe (lightweight model)
- **Background replacement** (blur, gradients, simple scenes)
- **Edge detection** for precise person segmentation
- **Optimized for low-resource environments**

### 👤 Face Enhancement
- **Skin smoothing** with fast bilateral filtering
- **Eye brightening** with selective enhancement
- **Teeth whitening** with HSV color space manipulation
- **Face detection** using MediaPipe Face Detection (lightweight model)

### 🎨 Color & Effects
- **Brightness/Contrast** adjustments using OpenCV
- **Saturation** control with HSV manipulation
- **Color filters** (warm, cool, sepia, B&W, vibrant)
- **Vintage effects** with fast sepia transformation

### ⚡ Performance Optimizations
- **No TensorFlow dependency** - uses only OpenCV and MediaPipe
- **Lightweight MediaPipe models** for better performance
- **Frame resizing** for faster processing
- **Optimized algorithms** for low-resource VMs
- **Memory-efficient processing** pipeline
