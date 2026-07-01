# X Media Downloader

Chrome extension for saving X/Twitter post media to local folders.

## What It Does

- Adds a save button to supported X/Twitter post images, videos, and GIF-style media.
- Saves media to folders you choose on your device.
- Keeps separate save-folder settings for images, videos, and GIF-style media.
- Saves GIF-style X/Twitter media as MP4 because X serves it as MP4-backed video.
- Tracks save status per media item, so each item shows its own loading and result state.
- Can prefer original image quality when X/Twitter provides it.
- Lets you customize filename templates and duplicate-file behavior.
- Supports Japanese and English UI text.

## Supported Sites

- `x.com`
- `twitter.com`

## Settings

Open the extension popup from the Chrome toolbar icon.

- **Save folders**: choose, reselect, or clear separate destination folders for images, videos, and GIF-style media.
- **Language**: use automatic detection, Japanese, or English.
- **Filename template**: customize saved filenames with variables such as `{author}`, `{tweetId}`, `{date}`, `{time}`, and `{originalName}`.
- **Duplicate behavior**: overwrite, skip, or rename when a filename already exists.
- **Prefer original image quality**: save the original image variant when available.

Full settings are available from the options page.

Developer diagnostics are shown only in local builds created with `pnpm build`.
Release packages created with `pnpm package` hide diagnostics.

## Current Scope

- X/Twitter image posts are supported.
- X/Twitter video posts are supported when the page API response exposes direct MP4 variants.
- X/Twitter GIF-style media is supported as MP4-backed media and saved with a `.mp4` filename.
- Bulk save UI is not supported yet.

## Privacy

See [docs/privacy-policy.md](docs/privacy-policy.md).

## License

MIT
