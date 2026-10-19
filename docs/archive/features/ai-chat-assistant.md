# AI Chat Assistant

## Overview

OrangeCat includes an AI-powered chat assistant that allows users to interact with a Large Language Model (LLM) directly on the website. The assistant is powered by Google Gemini 2.0 Flash-Lite, currently the cheapest LLM available.

## Features

- **Real-time Chat**: Users can type messages and receive AI responses instantly
- **Contextual Help**: The AI is trained to understand OrangeCat's Bitcoin crowdfunding platform
- **Cost-Effective**: Uses the cheapest available LLM (Google Gemini Flash-Lite)
- **Rate Limited**: Protected against abuse with strict rate limiting (5 requests per 5 minutes)
- **Error Handling**: Robust error handling for API failures and content filtering
- **Responsive Design**: Works on both desktop and mobile devices

## Technical Implementation

### LLM Provider

- **Model**: Google Gemini 2.0 Flash-Lite
- **Pricing**: $0.075 per 1M input tokens, $0.30 per 1M output tokens
- **Context Window**: 128K tokens
- **API**: Google Generative AI SDK

### Architecture

#### Frontend Component (`LLMChat.tsx`)

- React component with TypeScript
- Real-time message display with auto-scroll
- Error states and loading indicators
- Keyboard shortcuts (Enter to send, Escape to close)
- Click-outside-to-close functionality

#### API Route (`/api/chat`)

- Next.js App Router API route
- Server-side API key protection
- Rate limiting (5 requests per 5 minutes per IP)
- Input validation and sanitization
- Error handling for various failure modes

#### Integration

- Lazy-loaded component in root layout
- Available site-wide as a floating chat button
- System prompt optimized for OrangeCat assistance

## Rate Limiting

To prevent abuse and control costs, the chat feature includes strict rate limiting:

- **5 requests per 5 minutes** per IP address
- HTTP 429 responses with proper headers when limit exceeded
- Client-side rate limit feedback

## Security Considerations

- API keys stored server-side only (never exposed to client)
- Input validation and length limits (10,000 characters max)
- Content filtering through Gemini's built-in safety features
- Rate limiting prevents abuse
- Error messages don't leak sensitive information

## Usage Examples

The AI assistant can help users with:

- Understanding how OrangeCat works
- Bitcoin crowdfunding explanations
- Platform navigation assistance
- General questions about Bitcoin and crypto
- Project creation guidance
- Profile setup help

## System Prompt

```
You are OrangeCat's AI assistant. OrangeCat is a Bitcoin-native crowdfunding platform where users can fund projects directly with Bitcoin. Help users understand the platform, answer questions about Bitcoin crowdfunding, and assist with general inquiries. Be helpful, accurate, and promote the benefits of Bitcoin-based funding.
```

## Future Enhancements

Potential improvements for the AI chat feature:

- User authentication integration
- Chat history persistence
- Multi-language support
- Integration with user profiles/projects
- Voice input/output capabilities
- Advanced context awareness

## Cost Management

Current pricing makes this feature very affordable:

- Average conversation: ~500 tokens ($0.00015)
- 5 conversations per user per 5 minutes: ~$0.00075
- 1000 daily users: ~$0.75/day
- Monthly cost: ~$22.50

## Monitoring

The feature includes built-in monitoring through:

- API route error logging
- Rate limit tracking
- Usage analytics (tokens consumed, response times)
- Error rate monitoring

---

**Created**: 2025-12-09
**Last Modified**: 2025-12-09
**Last Modified Summary**: Initial documentation for AI chat assistant feature



