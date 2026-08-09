import { asyncHandler } from '../../utils/asyncHandler.js';
import { listModerationQueue, getModerationPost, moderatePost } from '../../services/agentMarketplaceService.js';
export const list = asyncHandler(async(req,res)=>res.json(await listModerationQueue(req.query)));
export const detail = asyncHandler(async(req,res)=>res.json(await getModerationPost(req.params.postId)));
export const moderate = asyncHandler(async(req,res)=>res.json({post:await moderatePost(req.user.userId,req.params.postId,req.body?.action,req.body?.reason||'')}));
