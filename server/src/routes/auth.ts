import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { comparePassword, generateToken } from '../utils/auth.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password are required' }
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      createdAt: true
    }
  });

  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User account not found' }
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' }
  });
});
