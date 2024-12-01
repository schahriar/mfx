---
sidebar_position: 2
---

# Browser and Video Support

:::warning[Browser support]

Support for [WebCodecs API](https://caniuse.com/webcodecs) used by this library is relatively new but well supported in Chromium based browsers.

As of July 24, Firefox does not support the needed APIs and only video encoding/decoding is possible in Safari.

:::

Videos are structured in form of:
- Video container → contains several streams of data defining the video format (video, audio, tracks)
- Encoded data (via codec) → contains binary representation of encoded (compressed) frames and audio

A container wraps encoded data of multiple types and can support multiple codecs. MFX primarily focuses on supporting `MP4` and `WebM (aka Matroska)` video containers and a subset of codecs supported by these containers that are natively available in the browser WebCodecs API:


## Video Support Table
While `codec` support heavily depends on the browser, `mfx` aims to provide support for the following container / codec pairs:

| Container | Codec       | Encode / Decode |
| --------  | ---------   | --------------- 
| MP4       | H.264/AVC   | Both            |
| MP4       | H.265/HEVC  | Decode(1)       |
| MP4       | VP8         | Both            |
| MP4       | VP9         | Both            |
| WebM      | VP8         | Both            |
| WebM      | VP9         | Both            |

### Audio Support

| Container | Codec       | Encode / Decode |
| --------  | ---------   | --------------- 
| MP4       | Opus        | Both            |
| MP4       | AAC         | Both(2)         |
| WebM      | Opus        | Both            |
| WebM      | Vorbis      | Both(2)         |

```
(1) Support for HEVC encoding is not available in WebCodec implementations as of 2024.
(2) Untested
```
