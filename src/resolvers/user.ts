import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { User } from '../entities/User';
import { MyContext } from 'src/types';
import argon2 from 'argon2';
import { EntityManager } from '@mikro-orm/postgresql';
import { cookieName } from '../config/constants';

// adding class istead of using @Arg too many times
@InputType()
class userInputs {
  @Field()
  username: string;
  @Field()
  email: string;
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
  // @Mutation(() => boolean)
  // async forgotPassword(@Arg('email') email: string, @Ctx() { em }: MyContext) {
  //   const person = em.findOne(User, { email });
  //   return true;
  // }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { em, req }: MyContext) {
    if (!req.session!.userId) {
      // you are not loged in
      return null;
    }
    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  //    Register
  @Mutation(() => UserResponse)
  async register(
    @Arg('userInputs') userInputs: userInputs,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (userInputs.username.length <= 2) {
      return { errors: [{ field: 'username', message: 'Length should be greater than 2' }] };
    }
    if (userInputs.email.length <= 2 || !userInputs.email.includes('@')) {
      return { errors: [{ field: 'email', message: 'Invalid email' }] };
    }
    if (userInputs.password.length <= 2) {
      return { errors: [{ field: 'password', message: 'Length should be greater than 2' }] };
    }
    const hashedPassword = await argon2.hash(userInputs.password);
    // Before using builder
    // const user = em.create(User, { username: userInputs.username, password: hashedPassword });
    // after query builder
    let user;
    try {
      // await em.persistAndFlush(user);
      // using query builder
      const result = await (em as EntityManager)
        .createQueryBuilder(User)
        .getKnexQuery()
        .insert({
          username: userInputs.username,
          email: userInputs.email,
          password: hashedPassword,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      user = result[0];
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
  async login(
    @Arg('userNameOrEmail') userNameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { em, req }: MyContext
  ) {
    const isEmail: boolean = userNameOrEmail.includes('@') ? true : false;
    const user = await em.findOne(
      User,
      isEmail ? { email: userNameOrEmail } : { username: userNameOrEmail }
    );
    if (!user) {
      return { errors: [{ field: 'username', message: "username or email doesn't exist!" }] };
    }
    const isMatch = await argon2.verify(user.password, password);
    if (!isMatch) {
      return { errors: [{ field: 'password', message: "password doesn't match!" }] };
    }
    req.session!.userId = user.id;
    return { user };
  }

  // Logout
  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise(resolve =>
      req.session?.destroy(err => {
        res.clearCookie(cookieName);
        if (err) {
          console.log(err.message);
          resolve(false);
          return;
        } else {
          resolve(true);
        }
      })
    );
  }
}
