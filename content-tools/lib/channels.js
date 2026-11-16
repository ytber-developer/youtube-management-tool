// Hằng số riêng của từng kênh — nguồn duy nhất cho validator, slide, metadata.
module.exports = {
  WPM: 163,
  // Lời đọc viết cho máy đọc (TTS) → chữ hiển thị trên phụ đề
  CAPTION_DISPLAY: [[/\bSagittarius A star\b/g, 'Sagittarius A*'], [/\bVoyager One\b/g, 'Voyager 1']],
  'cosmic-what-if': {
    name: 'Cosmic What If',
    outro: 'Follow Cosmic What If for more mind-bending science.',
    disclaimer: null,
    voiceHint: 'Adam (ElevenLabs) — trầm, chắc',
  },
  'inside-your-body': {
    name: 'Inside Your Body',
    outro: 'Follow Inside Your Body for more of the science of you.',
    disclaimer: 'This video is for educational purposes only and is not medical advice.',
    voiceHint: 'Chưa chọn — giọng ấm, rõ ràng (chọn trên ElevenLabs rồi ghi lại ở đây)',
  },
};
