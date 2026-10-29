export interface User { id:string; username:string; displayName:string; email?:string; bio?:string|null; avatarUrl?:string|null; coverUrl?:string|null; createdAt?:string; updatedAt?:string; postsCount?:number;followersCount?:number;followingCount?:number }
export interface Post { id:string; authorId?:string; author:User; body:string|null;imageUrl:string|null;createdAt:string;updatedAt?:string;likesCount:number;commentsCount:number;likedByMe:boolean }
export interface Comment { id:string;postId:string;authorId?:string;author:User;body:string;createdAt:string;commentsCount?:number }
export interface Page<T> {data:T[];meta:{page:number;limit:number;total:number;totalPages:number}}
export interface FollowUser extends User {isFollowedByMe:boolean}
export interface Message {id:string;conversationId:string;senderId:string;content:string;createdAt:string}
export interface Notification {id:string;userId:string;actorId:string;actor:User;type:'LIKE'|'COMMENT'|'FOLLOW'|'MESSAGE';postId:string|null;messageId:string|null;isRead:boolean;createdAt:string}
