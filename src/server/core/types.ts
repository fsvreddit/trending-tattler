import { Post } from "@devvit/web/server";

export interface PostFound {
    post: Post;
    foundInFeed: string[];
}
