import { Entity, Column, BaseEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';
import { Post } from './Post';

@Entity()
export class Updoot extends BaseEntity {
  @Column({ type: 'int' })
  value: number;

  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => User, user => user.updoots)
  user: User;

  @PrimaryColumn()
  postId: number;

  // Without Cascade (if we deleted post)
  // @ManyToOne(() => Post, post => post.updoots)
  // post: Post;

  // With Cascade (if we deleted post)
  @ManyToOne(() => Post, post => post.updoots, { onDelete: 'CASCADE' })
  post: Post;
}
