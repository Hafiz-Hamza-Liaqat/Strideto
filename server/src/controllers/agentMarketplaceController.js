import { asyncHandler } from '../utils/asyncHandler.js';
import * as marketplace from '../services/agentMarketplaceService.js';

export const listOwn = asyncHandler(async (req,res)=>res.json(await marketplace.listOwnPosts(req.agent.agentAccountId,req.query)));
export const getOwn = asyncHandler(async (req,res)=>res.json({post:await marketplace.getOwnPost(req.agent.agentAccountId,req.params.postId)}));
export const create = asyncHandler(async (req,res)=>res.status(201).json({post:await marketplace.createDraft(req.agent.agentAccountId,req.body||{})}));
export const update = asyncHandler(async (req,res)=>res.json({post:await marketplace.updateDraft(req.agent.agentAccountId,req.params.postId,req.body||{})}));
export const submit = asyncHandler(async (req,res)=>res.json({post:await marketplace.submitPost(req.agent.agentAccountId,req.params.postId)}));
export const archive = asyncHandler(async (req,res)=>res.json({post:await marketplace.archivePost(req.agent.agentAccountId,req.params.postId)}));
export const counts = asyncHandler(async (req,res)=>res.json({counts:await marketplace.marketplaceCounts(req.agent.agentAccountId)}));
export const listPublic = asyncHandler(async (req,res)=>res.json(await marketplace.listPublicMarketplace(req.query)));
export const getPublic = asyncHandler(async (req,res)=>res.json({post:await marketplace.getPublicPost(req.params.slug)}));
export const interest = asyncHandler(async (req,res)=>res.status(201).json(await marketplace.createInterest(req.user.userId,req.params.slug,req.body?.explicitConsent)));
export const withdraw = asyncHandler(async (req,res)=>res.json(await marketplace.withdrawInterest(req.user.userId,req.params.slug)));
