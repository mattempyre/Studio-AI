
import { Template, Project } from './types';

export const MOCK_TEMPLATES: Template[] = [
  {
    id: '1',
    title: 'Cinematic Documentary',
    description: 'High-fidelity storytelling with atmospheric grading, slow pans, and deep immersion.',
    duration: '10-15 min',
    category: 'Cinematic',
    thumbnail: 'https://picsum.photos/seed/docu/800/450',
    isPremium: true
  },
  {
    id: '2',
    title: 'Minimalist Sketch Informer',
    description: 'Clean, line-art aesthetic perfect for educational explainers and quick facts.',
    duration: '3-5 min',
    category: 'Educational',
    thumbnail: 'https://picsum.photos/seed/sketch/800/450',
    isNew: true
  },
  {
    id: '3',
    title: 'High-Energy Vlog',
    description: 'Fast-paced cuts, vibrant color grades, and bold dynamic text overlays.',
    duration: '5-10 min',
    category: 'Social Media',
    thumbnail: 'https://picsum.photos/seed/vlog/800/450',
  },
  {
    id: '4',
    title: 'Corporate Presentation',
    description: 'Sleek, professional transitions with grid-based layouts and brand integration.',
    duration: '5-20 min',
    category: 'Business',
    thumbnail: 'https://picsum.photos/seed/corp/800/450',
  }
];

export const INITIAL_PROJECT: Project = {
  id: 'new_proj',
  name: 'Future of AI',
  type: 'Documentary',
  status: 'draft',
  lastEdited: 'Just now',
  createdAt: '2024-01-15',
  progress: 35,
  textOverlays: [],
  voiceId: 'v_kore', // Default voice
  visualStyle: 'Cinematic',
  characters: [
    {
      id: 'char_1',
      name: 'Dr. Ada',
      description: 'A futuristic AI architect with glowing blue cybernetic implants.',
      imageUrl: 'https://picsum.photos/seed/ada/200/200',
    }
  ],
  script: [
    {
      id: 's1',
      title: 'Introduction & Hook',
      content: "Imagine a future where the boundary between human creativity and artificial intelligence is no longer a line, but a bridge. We are standing at the precipice of a new era in storytelling. An era where your most ambitious visions can be realized with the speed of thought. Today, we're exploring how AI is reshaping the cinematic landscape.",
      duration: '00:00 - 00:25'
    },
    {
      id: 's2',
      title: 'The Technology Deep Dive',
      content: "Our AI agents are now capable of understanding complex human emotions and translating them into cinematic visual experiences. By analyzing thousands of hours of high-quality film, Dr. Ada identifies lighting patterns, camera movements, and emotional beats that resonate. This isn't just automation—it's collaborative creation at its highest form.",
      duration: '00:25 - 00:55'
    }
  ],
  scenes: [
    // Section 1 - Scene 1
    {
      id: 'sc1',
      scriptSectionId: 's1',
      timestamp: '00:00 - 00:06',
      narration: 'Imagine a future where the boundary between human creativity and artificial intelligence is no longer a line, but a bridge.',
      imagePrompt: 'Wide cinematic shot of a glowing digital bridge connecting a human silhouette and a neural network, nebula background, 8k.',
      videoPrompt: 'Cinematic wide shot, slow pan right. A glowing digital bridge connecting a human silhouette and a neural network, nebula background.',
      imageUrl: 'https://picsum.photos/seed/bridge/800/450',
      cameraMovement: 'Pan Right',
      visualStyle: 'Cinematic'
    },
    // Section 1 - Scene 2
    {
      id: 'sc2',
      scriptSectionId: 's1',
      timestamp: '00:06 - 00:12',
      narration: 'We are standing at the precipice of a new era in storytelling.',
      imagePrompt: 'Silhouette of a filmmaker standing on a cliff edge looking out at a city made of light and film strips, sunrise, epic scale.',
      videoPrompt: 'Drone shot zooming out from silhouette of a filmmaker standing on a cliff edge, city made of light below, sunrise.',
      imageUrl: 'https://picsum.photos/seed/precipice/800/450',
      cameraMovement: 'Zoom Out',
      visualStyle: 'Cinematic'
    },
    // Section 1 - Scene 3
    {
      id: 'sc3',
      scriptSectionId: 's1',
      timestamp: '00:12 - 00:18',
      narration: 'An era where your most ambitious visions can be realized with the speed of thought.',
      imagePrompt: 'Close up of neurons firing in a brain, transitioning into galaxies, bright golden and blue hues, macro photography style.',
      videoPrompt: 'Macro video of neurons firing, morphing into galaxies, golden and blue hues, orbiting camera motion.',
      imageUrl: 'https://picsum.photos/seed/visions/800/450',
      cameraMovement: 'Orbit',
      visualStyle: 'Abstract'
    },
    // Section 1 - Scene 4
    {
      id: 'sc4',
      scriptSectionId: 's1',
      timestamp: '00:18 - 00:25',
      narration: "Today, we're exploring how AI is reshaping the cinematic landscape.",
      imagePrompt: 'Futuristic movie set with robotic camera arms and holographic directors, lens flare, high tech atmosphere.',
      videoPrompt: 'Tracking shot left through a futuristic movie set, robotic camera arms moving, holographic interfaces glowing.',
      imageUrl: 'https://picsum.photos/seed/landscape/800/450',
      cameraMovement: 'Truck Left',
      visualStyle: 'Tech'
    },
    // Section 2 - Scene 1
    {
      id: 'sc5',
      scriptSectionId: 's2',
      timestamp: '00:25 - 00:35',
      narration: 'Our AI agents are now capable of understanding complex human emotions and translating them into cinematic visual experiences.',
      imagePrompt: 'Close up of a robotic eye reflecting a human soul, purple iris, highly detailed, photorealistic, cinematic lighting.',
      videoPrompt: 'Slow zoom in on robotic eye, iris expanding, purple reflections, high detail.',
      imageUrl: 'https://picsum.photos/seed/eye/800/450',
      cameraMovement: 'Zoom In',
      visualStyle: 'Cyberpunk'
    },
    // Section 2 - Scene 2
    {
      id: 'sc6',
      scriptSectionId: 's2',
      timestamp: '00:35 - 00:45',
      narration: 'By analyzing thousands of hours of high-quality film, the system identifies lighting patterns, camera movements, and emotional beats that resonate.',
      imagePrompt: 'Abstract visualization of film data streams, matrix code style but with movie frames, deep depth of field.',
      videoPrompt: 'Data visualization video, film streams flowing upwards, deep depth of field, panning up.',
      imageUrl: 'https://picsum.photos/seed/data/800/450',
      cameraMovement: 'Pan Up',
      visualStyle: 'Data'
    },
    // Section 2 - Scene 3
    {
      id: 'sc7',
      scriptSectionId: 's2',
      timestamp: '00:45 - 00:55',
      narration: "This isn't just automation—it's collaborative creation at its highest form.",
      imagePrompt: 'A human hand touching a robotic hand, sparks of creativity flying between them, Michelangelo style composition, warm lighting.',
      videoPrompt: 'Cinematic video, static shot of human hand touching robotic hand, sparks flying, warm lighting.',
      imageUrl: 'https://picsum.photos/seed/collab/800/450',
      cameraMovement: 'Static',
      visualStyle: 'Artistic'
    }
  ],
  audioTracks: [
    {
      id: 'track_vo',
      type: 'voice',
      name: 'Voice Over',
      volume: 1.0,
      isMuted: false,
      clips: [
        { id: 'clip_vo1', name: 'Intro & Hook', startTime: 0, duration: 25 },
        { id: 'clip_vo2', name: 'Tech Deep Dive', startTime: 25, duration: 30 }
      ]
    },
    {
      id: 'track_music_1',
      type: 'music',
      name: 'Music Track 1',
      volume: 0.8,
      isMuted: false,
      clips: [
        { id: 'clip_m1', name: 'Epic Rise (Looped)', startTime: 0, duration: 55 }
      ]
    },
    {
      id: 'track_sfx_1',
      type: 'sfx',
      name: 'SFX Track 1',
      volume: 0.6,
      isMuted: false,
      clips: [
        { id: 'clip_sfx1', name: 'Whoosh', startTime: 5, duration: 2 },
        { id: 'clip_sfx2', name: 'Digital Glitch', startTime: 25, duration: 3 }
      ]
    }
  ]
};
