import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// bcrypt and Prisma both require the Node.js runtime.
export const runtime = 'nodejs';
