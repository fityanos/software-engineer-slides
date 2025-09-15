# Software Engineer Slides

A modern, AI-powered slide generator that transforms your text into beautiful, animated presentations. Built with React, Framer Motion, and OpenAI's GPT-4o-mini.

![Software Engineer Slides](https://img.shields.io/badge/React-18+-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-38B2AC) ![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991) ![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🎨 **Beautiful Design**
- **Modern UI**: Clean, professional interface with dark/light themes
- **Smooth Animations**: Framer Motion powered transitions and effects
- **Responsive**: Works perfectly on desktop, tablet, and mobile
- **Customizable**: Multiple themes, accents, and animation styles

### 🤖 **AI-Powered Content**
- **Smart Generation**: Uses OpenAI's GPT-4o-mini to enhance your text
- **Contextual Enhancement**: Automatically enriches short or ambiguous content
- **Multiple Tones**: Choose from inspiring, professional, casual, or technical
- **Length Control**: Generate concise or detailed slide content

### 📊 **Professional Slides**
- **Auto-Chunking**: Intelligently splits content into slide-sized pieces
- **Title & Body**: Automatically extracts titles and content for each slide
- **Multiple Formats**: 16:9 and 4:3 aspect ratios
- **Export Options**: PNG and PPTX export with customizable settings

### 🎯 **User Experience**
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Presentation Mode**: Fullscreen presentation with auto-advance
- **Settings Persistence**: Your preferences are saved automatically
- **Free Tier**: 5 AI-generated slide sets per day

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/animated-slides.git
   cd animated-slides
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```

4. **Start development server**
   ```bash
   npm run dev:full
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run server` - Start backend server
- `npm run dev:full` - Start both frontend and backend
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Project Structure

```
animated-slides/
├── src/
│   ├── App.jsx          # Main application component
│   ├── index.css        # Global styles and fonts
│   └── main.jsx         # Application entry point
├── server/
│   └── index.js         # Express backend server
├── api/
│   └── story.js         # Vercel serverless function
├── public/              # Static assets
└── dist/                # Production build
```

## 🎨 Customization

### Themes
- **Dark Theme**: Modern dark interface (default)
- **Light Theme**: Clean light interface

### Accent Colors
- Indigo (default)
- Blue
- Purple
- Green
- Red
- Orange

### Animation Styles
- Fade (default)
- Slide
- Scale
- Bounce

### AI Settings
- **Model**: GPT-4o-mini (cost-effective)
- **Tone**: Inspiring, Professional, Casual, Technical
- **Length**: Short, Medium, Long

## 📱 Usage

### Basic Workflow

1. **Enter Text**: Paste your content in the main text area
2. **Generate**: Click "GENERATE" to enhance with AI (optional)
3. **Customize**: Adjust settings in the settings panel
4. **Present**: Click the play button to start presentation
5. **Export**: Save as PNG or PPTX files

### Keyboard Shortcuts

- `Space` / `→` - Next slide
- `←` - Previous slide
- `P` - Toggle presentation mode
- `Esc` - Exit presentation mode
- `?` - Show help

### Settings Panel

Access via the gear icon in the top-right corner:

- **Theme & Accent**: Visual customization
- **Animation**: Transition effects
- **Aspect Ratio**: 16:9 or 4:3
- **Export Settings**: PNG scale and padding
- **AI Settings**: Model, tone, and length preferences

## 🔒 Security & Privacy

- **No Data Storage**: Your content is never stored on our servers
- **API Key Protection**: Server-side API key handling
- **Rate Limiting**: Multi-layer protection (per-IP, per-day, and global daily limits)
- **Input Validation**: All inputs are sanitized and validated

For detailed security information, see [SECURITY.md](./SECURITY.md).

## 💰 Pricing

### Free Tier
- 5 AI-generated slide sets per day per IP
- 2 requests per minute per IP
- Global daily limit: 100 total requests across all users
- All basic features included
- No registration required

### Support the Project
When you reach the daily limit, you'll see options to:
- ☕ Buy me a coffee
- 💖 GitHub Sponsors
- Continue with basic features

## 🚀 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository
   - Add environment variables in Vercel dashboard
   - Deploy automatically

### Environment Variables

```env
OPENAI_API_KEY=sk-your-api-key-here
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_RPM=2
FREE_TIER_DAILY=5
GLOBAL_DAILY_LIMIT=100
ALLOWED_MODELS=gpt-4o-mini
MAX_RAW_BYTES=8192
MAX_COMPLETION_TOKENS=600
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI framework
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [OpenAI](https://openai.com/) - AI content generation
- [Vercel](https://vercel.com/) - Deployment platform

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/fityanos/software-engineer-slides/issues)
- **Discussions**: [GitHub Discussions](https://github.com/fityanos/software-engineer-slides/discussions)

---

**Made with ❤️ by [Anas Fitiani](https://github.com/fityanos)**