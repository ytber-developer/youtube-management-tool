// Hằng số riêng của từng kênh — nguồn duy nhất cho validator, slide, metadata.
module.exports = {
  WPM: 163,
  // Lời đọc viết cho máy đọc (TTS) → chữ hiển thị trên phụ đề
  CAPTION_DISPLAY: [[/\bSagittarius A star\b/g, 'Sagittarius A*'], [/\bVoyager One\b/g, 'Voyager 1'], [/\bB P P V\b/g, 'BPPV'], [/\bBor, bo, rig, me\b/g, 'borborygmi'],
    [/\bGliese seven ten\b/g, 'Gliese 710'], [/\bWISE zero eight five five\b/g, 'WISE 0855'], [/\b[Ss]ixty-seven P\b/g, '67P'],
    [/\b[Tt]wo thousand one, A Space Odyssey\b/g, '2001: A Space Odyssey']],
  'cosmic-what-if': {
    name: 'Cosmic What If',
    outro: 'Follow Cosmic What If for more mind-bending science.',
    disclaimer: null,
    voiceHint: 'Adam (ElevenLabs) — trầm, chắc',
    ttsVoice: 'am_michael', // Kokoro (offline, miễn phí)
  },
  'inside-your-body': {
    name: 'Inside Your Body',
    outro: 'Follow Inside Your Body for more of the science of you.',
    disclaimer: 'This video is for educational purposes only and is not medical advice.',
    voiceHint: 'Chưa chọn — giọng ấm, rõ ràng (chọn trên ElevenLabs rồi ghi lại ở đây)',
    ttsVoice: 'af_heart', // Kokoro (offline, miễn phí)
  },
};
