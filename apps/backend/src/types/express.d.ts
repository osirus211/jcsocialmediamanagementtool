import { Types } from 'mongoose';

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      email: string;
      role: string;
    }

    interface WorkspacePayload {
      workspaceId: Types.ObjectId;
      role: string;
      memberId: Types.ObjectId;
    }

    interface Request {
      user?: UserPayload;
      workspace?: WorkspacePayload;
    }
  }
}

export {};
