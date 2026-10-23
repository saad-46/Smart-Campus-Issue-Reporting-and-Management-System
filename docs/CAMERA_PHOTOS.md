# Photos and the camera

Attaching a photo is always optional. A report can be submitted without one.

## What a person sees

| Where | Controls |
| --- | --- |
| Signed-in report form (Photos step) | **Add photo** (file picker), **Take photo** (see below), preview, draw on it, remove. Up to 3 photos |
| Worker resolving a task (receipt) | **Upload receipt**, **Take photo**, preview, remove |
| Explore (`/viewer/report`) | "Attach a sample photo": a generated illustration. No camera, no file is read or stored (a documented, deliberate difference: see `docs/EXPLORE_PARITY.md`) |

**Take photo** depends on the device:

- **Phone or tablet** (touch-first): the native camera app, through `<input type="file" capture="environment">`. This is the most reliable path on Android and iOS.
- **Desktop or laptop** over HTTPS (or `localhost`): a live preview dialog (`getUserMedia`) with a **Take photo** button. The camera is requested only after the dialog is opened, never on page load.
- **Anywhere the camera API is missing or the page is not a secure context**: the button is not offered; **Add photo** still works.

Before this change the **Take photo** control was hidden on screens wider than a phone (`sm:hidden`), so desktop users had no camera option.

## Failure handling

| Situation | What happens |
| --- | --- |
| Permission denied | The dialog says the camera is blocked and where to allow it (browser site settings), and offers **Upload a photo instead** |
| No camera / camera busy / unsupported | A specific message and the same upload fallback |
| Dialog closed (Cancel, Escape, X), photo taken, or page left | Every media track is stopped (the camera light goes off). If the dialog closes while the permission prompt is still open, the stream is released as soon as it arrives |
| Not an image, GIF, empty file, or larger than 5 MB | Refused with a message; nothing is attached |
| More than 3 photos | The add controls disappear at the limit; removing one frees a slot |
| Form validation fails | The chosen photos are kept |

A captured frame becomes an ordinary JPEG `File` (long edge capped at 1600 px) and then follows the same path as a chosen file: type and size check, compression to the stored-size budget, thumbnail. The submitted photo is the image the person saw in the preview.

## Where photos are stored

Unchanged architecture: compressed images are saved as separate documents under `issues/{id}/images` (the issue document carries only small thumbnails), receipts under `issues/{id}/receipts/receipt`. Access follows the issue's Firestore rules. There is no Cloud Storage bucket, so there are no Storage rules to deploy or test.

## What the automated tests prove, and what they do not

`e2e/camera.emulator.spec.ts` (local emulators only) uses Chromium's **fake camera** (a generated test pattern) and scripted `getUserMedia` failures. It proves the UI, permission handling, track cleanup, the file checks, the limit, and that nothing in Explore touches the camera. `tests/unit/authActivityProfile.test.ts` covers the support detection, the error messages and the file checks.

It does **not** prove that a real webcam or phone camera works. Check that by hand:

### Manual device checklist

1. Open the deployed HTTPS site, sign in as a student, open **Report an issue**.
2. **Desktop (Chrome, Edge, Firefox, Safari):** press **Take photo**; allow the camera; the live picture appears; press **Take photo**; the preview appears and the camera light goes off.
3. Repeat with permission **blocked** in site settings: the explanation and **Upload a photo instead** appear; the upload works.
4. **Android (Chrome):** **Take photo** opens the camera app; after the shot the preview appears. **Add photo** offers the gallery.
5. **iPhone (Safari):** same. Confirm that a HEIC photo is accepted (iOS normally converts to JPEG when the picker is limited to JPEG/PNG/WebP, as it is here); this has not been verified on a device.
6. Attach three photos, remove one, add another, submit. Open the issue: the photos are shown.
7. Submit once with no photo.
8. Open `/viewer/report`: only "Attach a sample photo" is offered; the browser never asks for the camera.
