import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { processAssistantMessage, AssistantContext } from '../services/assistantService.js';

export const handleAssistantChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in with your @kongu.edu account.',
      });
      return;
    }

    const { message, context } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Please provide a non-empty message for the assistant.',
      });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({
        success: false,
        message: 'Message is too long. Please keep your question under 500 characters.',
      });
      return;
    }

    // Sanitize context if provided
    let safeContext: AssistantContext | undefined = undefined;
    if (context && typeof context === 'object') {
      safeContext = {
        previousSearch: context.previousSearch && typeof context.previousSearch === 'object' ? context.previousSearch : undefined,
        previousResultIds: Array.isArray(context.previousResultIds)
          ? context.previousResultIds.filter((id: any) => typeof id === 'string').slice(0, 20)
          : undefined,
        currentAuctionId: typeof context.currentAuctionId === 'string' ? context.currentAuctionId : undefined,
      };
    }

    const userId = req.user._id.toString();
    const result = await processAssistantMessage(userId, message.trim(), safeContext);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Assistant Controller Error]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process assistant request. Please try again.',
    });
  }
};
