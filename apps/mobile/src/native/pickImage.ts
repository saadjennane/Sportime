import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/** True when the native camera/gallery picker should be used (device only). */
export function canUseNativeCamera(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Open the native picker (prompts Camera vs Photos), then return the chosen
 * image as a File ready to upload — same shape the web <input type="file">
 * produces, so the rest of the upload flow is unchanged.
 * Returns null if the user cancels.
 */
export async function pickProfileImageNative(): Promise<File | null> {
  const photo = await Camera.getPhoto({
    source: CameraSource.Prompt, // user picks Camera or Photo Library
    resultType: CameraResultType.Uri,
    quality: 80,
    width: 512,
    height: 512,
    correctOrientation: true,
    promptLabelHeader: 'Profile photo',
    promptLabelPhoto: 'Choose from gallery',
    promptLabelPicture: 'Take a photo',
  });

  if (!photo?.webPath) return null;

  const res = await fetch(photo.webPath);
  const blob = await res.blob();
  const ext = photo.format || 'jpeg';
  return new File([blob], `profile.${ext}`, { type: blob.type || `image/${ext}` });
}
