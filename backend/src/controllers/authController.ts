import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User';
import { AuthRequest } from '../middlewares/auth';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const generateToken = (userId: string, email: string): string => {
  const secret = process.env.JWT_SECRET || 'super_secret_study_assistant_jwt_key_2026';
  return jwt.sign({ id: userId, email }, secret, { expiresIn: '7d' });
};

export const register = async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Create user
    const newUser = new User({
      name: validatedData.name,
      email: validatedData.email,
      password: validatedData.password,
    });

    await newUser.save();

    const token = generateToken(newUser._id.toString(), newUser.email);

    return res.status(201).json({
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        subscriptionStatus: newUser.subscriptionStatus,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await (user as any).comparePassword(validatedData.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id.toString(), user.email);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error during login' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Internal server error fetching profile' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email });
    if (!user) {
      return res.status(404).json({ message: 'User with this email does not exist' });
    }

    // In a production app, we would send a reset token via email.
    // For this single-tenant study app, we will directly update the password as requested
    user.password = validatedData.newPassword;
    await user.save();

    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal server error during password reset' });
  }
};

const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const validatedData = googleLoginSchema.parse(req.body);
    const { credential } = validatedData;

    // Verify token with Google API using native node fetch
    const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    
    if (!googleResponse.ok) {
      return res.status(400).json({ message: 'Invalid Google credential' });
    }

    const payload = (await googleResponse.json()) as {
      aud: string;
      email: string;
      name: string;
      picture?: string;
      email_verified?: string | boolean;
    };

    // Verify Audience to prevent token replay attacks
    const clientID = process.env.GOOGLE_CLIENT_ID;
    if (clientID && payload.aud !== clientID) {
      return res.status(400).json({ message: 'Google Client ID audience mismatch' });
    }

    // Check if email_verified is true
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      return res.status(400).json({ message: 'Google email is not verified' });
    }

    // Find or create user
    let user = await User.findOne({ email: payload.email });

    if (!user) {
      // Create user with a randomized secure password since they use Google SSO
      const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      user = new User({
        name: payload.name,
        email: payload.email,
        password: randomPassword,
        avatar: payload.picture || '',
      });
      await user.save();
    } else if (payload.picture && user.avatar !== payload.picture) {
      user.avatar = payload.picture;
      await user.save();
    }

    const token = generateToken(user._id.toString(), user.email);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error('Google login error:', error);
    return res.status(500).json({ message: 'Internal server error during Google login' });
  }
};

export const guestLogin = async (req: Request, res: Response) => {
  try {
    const randomId = Math.random().toString(36).substring(2, 10);
    const guestEmail = `guest_${randomId}@studypilot.guest`;
    const guestPassword = `guest_secret_pass_${randomId}`;

    const guestUser = new User({
      name: `Guest_${randomId}`,
      email: guestEmail,
      password: guestPassword,
      subscriptionStatus: 'free',
    });

    await guestUser.save();

    const token = generateToken(guestUser._id.toString(), guestUser.email);

    return res.status(201).json({
      token,
      user: {
        id: guestUser._id,
        name: guestUser.name,
        email: guestUser.email,
        subscriptionStatus: guestUser.subscriptionStatus,
      },
    });
  } catch (error: any) {
    console.error('Guest login error:', error);
    return res.status(500).json({ message: 'Internal server error during guest login' });
  }
};
