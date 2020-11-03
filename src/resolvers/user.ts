import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { User } from '../entities/User';
import { MyContext } from 'src/types';
import argon2 from 'argon2';

// adding class istead of using @Arg too many times
@InputType()
class userInputs {
  @Field()
  username: string;
  @Field()
  password: string;
}

// Error handling
@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session!.userId) {
      // you are not loged in
      return null;
    }
    const user = await em.findOne(User, { id: req.session!.userId });
    return user;
  }

  //    Register
  @Mutation(() => UserResponse)
  async register(
    @Arg('userIputs') userInputs: userInputs,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (userInputs.username.length <= 2) {
      return { errors: [{ field: 'username', message: 'Length should be greater than 2' }] };
    }
    if (userInputs.password.length <= 2) {
      return { errors: [{ field: 'password', message: 'Length should be greater than 2' }] };
    }
    const hashedPassword = await argon2.hash(userInputs.password);
    const user = em.create(User, { username: userInputs.username, password: hashedPassword });
    try {
      await em.persistAndFlush(user);
    } catch (error) {
      if (error.code === '23505') {
        return { errors: [{ field: 'username', message: 'username already exist' }] };
      }
    }
    // Login after registration by adding userId to cookies session
    req.session!.userId = user.id;
    return { user };
  }

  //  Login
  @Mutation(() => UserResponse)
  async login(@Arg('userIputs') userInputs: userInputs, @Ctx() { em, req }: MyContext) {
    const user = await em.findOne(User, { username: userInputs.username });
    if (!user) {
      return { errors: [{ field: 'username', message: "username doesn't exist!" }] };
    }
    const isMatch = await argon2.verify(user.password, userInputs.password);
    if (!isMatch) {
      return { errors: [{ field: 'password', message: "password doesn't match!" }] };
    }
    req.session!.userId = user.id;
    return { user };
  }
}
