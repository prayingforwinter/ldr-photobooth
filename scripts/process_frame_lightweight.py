#!/usr/bin/env python3
import sys
import json
import base64
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image, ImageEnhance, ImageFilter
from io import BytesIO

# Initialize MediaPipe (lightweight AI models)
mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh
mp_selfie_segmentation = mp.solutions.selfie_segmentation
mp_drawing = mp.solutions.drawing_utils

class LightweightAIProcessor:
    def __init__(self):
        # Use lighter MediaPipe models
        self.face_detection = mp_face_detection.FaceDetection(
            model_selection=0,  # 0 for short-range (lighter), 1 for full-range
            min_detection_confidence=0.5
        )
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=False,  # Disable for better performance
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.selfie_segmentation = mp_selfie_segmentation.SelfieSegmentation(
            model_selection=0  # 0 for general model (lighter), 1 for landscape
        )
    
    def process_frame(self, frame_data, filters):
        try:
            # Decode base64 frame
            if ',' in frame_data:
                frame_bytes = base64.b64decode(frame_data.split(',')[1])
            else:
                frame_bytes = base64.b64decode(frame_data)
            
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("Could not decode frame")
            
            # Resize frame for faster processing if too large
            height, width = frame.shape[:2]
            if width > 1280:
                scale = 1280 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))
            
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply filters based on settings
            processed_frame = self.apply_filters(rgb_frame, filters)
            
            # Convert back to BGR for encoding
            bgr_frame = cv2.cvtColor(processed_frame, cv2.COLOR_RGB2BGR)
            
            # Encode back to base64 with compression
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]  # Reduce quality for performance
            _, buffer = cv2.imencode('.jpg', bgr_frame, encode_param)
            encoded_frame = base64.b64encode(buffer).decode('utf-8')
            
            return f"data:image/jpeg;base64,{encoded_frame}"
            
        except Exception as e:
            raise Exception(f"Frame processing error: {str(e)}")
    
    def apply_filters(self, frame, filters):
        processed = frame.copy()
        
        # Background removal and replacement (lightweight)
        if filters.get('backgroundRemoval', False):
            processed = self.remove_background_lightweight(processed, filters.get('backgroundReplacement', 'blur'))
        
        # Face enhancement (using OpenCV only)
        if filters.get('faceEnhancement', False):
            processed = self.enhance_face_opencv(processed, filters)
        
        # Color adjustments (pure OpenCV/NumPy)
        processed = self.adjust_colors_fast(processed, filters)
        
        # Special effects (lightweight)
        processed = self.apply_effects_fast(processed, filters)
        
        return processed
    
    def remove_background_lightweight(self, frame, replacement_type):
        try:
            # Use MediaPipe for segmentation (lighter model)
            results = self.selfie_segmentation.process(frame)
            
            if results.segmentation_mask is not None:
                # Create mask with some smoothing
                mask = results.segmentation_mask > 0.1  # Lower threshold for better edge detection
                
                # Smooth the mask edges
                mask_uint8 = (mask * 255).astype(np.uint8)
                mask_smooth = cv2.GaussianBlur(mask_uint8, (5, 5), 0)
                mask_smooth = mask_smooth / 255.0
                
                # Create 3D mask
                mask_3d = np.stack([mask_smooth] * 3, axis=-1)
                
                if replacement_type == 'blur':
                    # Blur background
                    blurred = cv2.GaussianBlur(frame, (15, 15), 0)
                    frame = (frame * mask_3d + blurred * (1 - mask_3d)).astype(np.uint8)
                elif replacement_type == 'gradient':
                    # Create simple gradient background
                    h, w = frame.shape[:2]
                    gradient = np.linspace(50, 200, h).reshape(h, 1, 1)
                    gradient = np.repeat(gradient, w, axis=1)
                    gradient = np.stack([gradient * 0.8, gradient * 0.9, gradient], axis=2).astype(np.uint8)
                    frame = (frame * mask_3d + gradient * (1 - mask_3d)).astype(np.uint8)
                elif replacement_type == 'beach':
                    # Simple beach-like gradient
                    h, w = frame.shape[:2]
                    sky = np.full((h//2, w, 3), [135, 206, 235], dtype=np.uint8)  # Sky blue
                    sand = np.full((h - h//2, w, 3), [238, 203, 173], dtype=np.uint8)  # Sandy brown
                    beach_bg = np.vstack([sky, sand])
                    frame = (frame * mask_3d + beach_bg * (1 - mask_3d)).astype(np.uint8)
                else:
                    # Default: darken background
                    darkened = (frame * 0.3).astype(np.uint8)
                    frame = (frame * mask_3d + darkened * (1 - mask_3d)).astype(np.uint8)
        except Exception as e:
            print(f"Background removal error: {e}", file=sys.stderr)
            # Return original frame if background removal fails
            pass
        
        return frame
    
    def enhance_face_opencv(self, frame, filters):
        try:
            # Detect faces using MediaPipe
            results = self.face_detection.process(frame)
            
            if results.detections:
                for detection in results.detections:
                    # Get face bounding box
                    bbox = detection.location_data.relative_bounding_box
                    h, w, _ = frame.shape
                    
                    x = max(0, int(bbox.xmin * w))
                    y = max(0, int(bbox.ymin * h))
                    width = min(w - x, int(bbox.width * w))
                    height = min(h - y, int(bbox.height * h))
                    
                    if width > 0 and height > 0:
                        # Extract face region
                        face_region = frame[y:y+height, x:x+width].copy()
                        
                        # Apply skin smoothing (lightweight bilateral filter)
                        smoothing = filters.get('skinSmoothing', 0) / 100.0
                        if smoothing > 0:
                            face_region = self.smooth_skin_fast(face_region, smoothing)
                        
                        # Apply eye brightening (simple brightness adjustment to upper face)
                        eye_brightness = filters.get('eyeBrightening', 0) / 100.0
                        if eye_brightness > 0:
                            face_region = self.brighten_eyes_fast(face_region, eye_brightness)
                        
                        # Apply teeth whitening (detect mouth area and enhance)
                        teeth_whitening = filters.get('teethWhitening', 0) / 100.0
                        if teeth_whitening > 0:
                            face_region = self.whiten_teeth_fast(face_region, teeth_whitening)
                        
                        # Put face back
                        frame[y:y+height, x:x+width] = face_region
        except Exception as e:
            print(f"Face enhancement error: {e}", file=sys.stderr)
            # Return original frame if face enhancement fails
            pass
        
        return frame
    
    def smooth_skin_fast(self, face, intensity):
        # Fast skin smoothing using bilateral filter
        kernel_size = max(5, int(10 * intensity))
        if kernel_size % 2 == 0:
            kernel_size += 1
        
        smoothed = cv2.bilateralFilter(face, kernel_size, 40, 40)
        return cv2.addWeighted(face, 1 - intensity * 0.7, smoothed, intensity * 0.7, 0)
    
    def brighten_eyes_fast(self, face, intensity):
        # Simple brightness adjustment for eye region (top 1/3 of face)
        h = face.shape[0]
        eye_region = face[:h//3, :].copy()
        brightened = cv2.convertScaleAbs(eye_region, alpha=1 + intensity * 0.2, beta=intensity * 15)
        face[:h//3, :] = brightened
        return face
    
    def whiten_teeth_fast(self, face, intensity):
        # Simple teeth whitening for mouth region (bottom 1/3 of face)
        h = face.shape[0]
        mouth_region = face[2*h//3:, :].copy()
        
        # Convert to HSV for better color manipulation
        hsv = cv2.cvtColor(mouth_region, cv2.COLOR_RGB2HSV)
        
        # Increase brightness and reduce saturation slightly
        hsv[:, :, 2] = cv2.add(hsv[:, :, 2], int(intensity * 20))  # Increase brightness
        hsv[:, :, 1] = cv2.multiply(hsv[:, :, 1], 1 - intensity * 0.1)  # Reduce saturation slightly
        
        whitened = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        face[2*h//3:, :] = whitened
        return face
    
    def adjust_colors_fast(self, frame, filters):
        # Fast color adjustments using OpenCV
        processed = frame.copy()
        
        # Brightness
        brightness = filters.get('brightness', 0)
        if brightness != 0:
            processed = cv2.convertScaleAbs(processed, alpha=1, beta=brightness * 2)
        
        # Contrast
        contrast = filters.get('contrast', 0)
        if contrast != 0:
            alpha = 1 + (contrast / 100.0)
            processed = cv2.convertScaleAbs(processed, alpha=alpha, beta=0)
        
        # Saturation
        saturation = filters.get('saturation', 0)
        if saturation != 0:
            hsv = cv2.cvtColor(processed, cv2.COLOR_RGB2HSV)
            hsv[:, :, 1] = cv2.multiply(hsv[:, :, 1], 1 + saturation / 100.0)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
            processed = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        
        return processed
    
    def apply_effects_fast(self, frame, filters):
        processed = frame.copy()
        
        # Vintage effect (fast sepia)
        if filters.get('vintage', False):
            # Fast sepia transformation
            sepia_filter = np.array([[0.393, 0.769, 0.189],
                                   [0.349, 0.686, 0.168],
                                   [0.272, 0.534, 0.131]])
            processed = cv2.transform(processed, sepia_filter.T)
            processed = np.clip(processed, 0, 255).astype(np.uint8)
        
        # Color filters (fast implementations)
        color_filter = filters.get('colorFilter', 'none')
        if color_filter == 'warm':
            # Increase red, decrease blue
            processed[:, :, 0] = np.clip(processed[:, :, 0] * 1.15, 0, 255)  # More red
            processed[:, :, 2] = np.clip(processed[:, :, 2] * 0.85, 0, 255)  # Less blue
        elif color_filter == 'cool':
            # Decrease red, increase blue
            processed[:, :, 0] = np.clip(processed[:, :, 0] * 0.85, 0, 255)  # Less red
            processed[:, :, 2] = np.clip(processed[:, :, 2] * 1.15, 0, 255)  # More blue
        elif color_filter == 'bw':
            # Fast grayscale conversion
            gray = cv2.cvtColor(processed, cv2.COLOR_RGB2GRAY)
            processed = cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
        elif color_filter == 'sepia':
            # Quick sepia effect
            processed = cv2.cvtColor(processed, cv2.COLOR_RGB2GRAY)
            processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2RGB)
            processed[:, :, 0] = np.clip(processed[:, :, 0] * 0.8, 0, 255)  # Reduce red
            processed[:, :, 1] = np.clip(processed[:, :, 1] * 0.9, 0, 255)  # Slightly reduce green
        elif color_filter == 'vibrant':
            # Increase saturation for vibrant look
            hsv = cv2.cvtColor(processed, cv2.COLOR_RGB2HSV)
            hsv[:, :, 1] = cv2.multiply(hsv[:, :, 1], 1.3)
            hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
            processed = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
        
        # Background blur (if not using background removal)
        blur_amount = filters.get('blur', 0)
        if blur_amount > 0 and not filters.get('backgroundRemoval', False):
            # Simple overall blur
            kernel_size = max(3, blur_amount * 2 + 1)
            if kernel_size % 2 == 0:
                kernel_size += 1
            processed = cv2.GaussianBlur(processed, (kernel_size, kernel_size), 0)
        
        return processed

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        frame_data = data['frameData']
        filters = data['filters']
        
        # Process frame with lightweight AI
        processor = LightweightAIProcessor()
        processed_frame = processor.process_frame(frame_data, filters)
        
        # Output result
        result = {
            'success': True,
            'processedFrame': processed_frame
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
