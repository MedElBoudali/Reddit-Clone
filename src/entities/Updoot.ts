import { Entity, Column, BaseEntity, ManyToOne, PrimaryColumn } from 'typeorm';
import { Field, ObjectType } from 'type-graphql';
import { User } from './User';
import { Post } from './Post';

@ObjectType()
@Entity()
export class Updoot extends BaseEntity {
  @Field()
  @Column({ type: 'int' })
  value: number;

  @Field()
  @PrimaryColumn()
  userId: number;

  @Field()
  @ManyToOne(() => User, user => user.updoot)
  user: User;

  @Field()
  @PrimaryColumn()
  postId: number;

  @Field()
  @ManyToOne(() => Post, post => post.updoot)
  post: Post;
}
