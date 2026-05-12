import { Post } from "@devvit/public-api";

export interface PostFound {
    post: Post;
    foundInFeed: string[];
}
