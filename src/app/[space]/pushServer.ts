// The server half of browser push (lib/push/browserPush.ts), bound to this space's Server Actions.
import type { PushServer } from '@/lib/push/browserPush';
import { forgetPushAction, isPushSavedAction, savePushAction } from './pushActions';

export const pushServer: PushServer = { save: savePushAction, forget: forgetPushAction, isSaved: isPushSavedAction };
