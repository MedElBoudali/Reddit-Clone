import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root
} from 'type-graphql';
import { User } from '../entities/User';
import { MyContext } from 'src/types';
import argon2 from 'argon2';
import { cookieName, FORGET_PASSWORD_PREFIX } from '../config/constants';
import { sendEmail } from '../utils/sendEmail';
import { v4 } from 'uuid';
import { getConnection } from 'typeorm';

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

@Resolver(User) // add User type only when we use FieldResolver
export class UserResolver {
  // show email just if the creator is the user logged in
  @FieldResolver() // will return new Field or modifie if existed
  email(@Root() user: User, @Ctx() { req }: MyContext) {
    if (req.session.userId === user.id) {
      return user.email;
    }
    return '';
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { req, redis }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return { errors: [{ field: 'newPassword', message: 'Length should be greater than 2' }] };
    }
    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return { errors: [{ field: 'token', message: 'Sorry, your token expired!' }] };
    }

    // if we have token on redis
    const uid = Number(userId);
    const user = await User.findOne({ id: uid });
    if (!user) {
      // if we didn't found the user
      return { errors: [{ field: 'user', message: 'user no longer exists' }] };
    }
    // if no errors hash new password and update
    await User.update({ id: uid }, { password: await argon2.hash(newPassword) });
    // delete token from redis
    redis.del(key);
    // Login after changing password
    req.session!.userId = user.id;
    return {
      user
    };
  }

  // generating token and store it in redis
  @Mutation(() => Boolean)
  async forgotPassword(@Arg('email') email: string, @Ctx() { redis }: MyContext) {
    const user = await User.findOne({ where: { email: email } });
    if (!user) {
      // email not found on our DB
      return true;
    }

    const token = v4();
    await redis.set(FORGET_PASSWORD_PREFIX + token, user.id, 'ex', 1000 * 60 * 60 * 24 * 3); // for 3days
    await sendEmail(
      email,
      `<a href="${process.env.DOMAIN_URL}/change-password/${token}">Reset Paswword</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext) {
    if (!req.session!.userId) {
      // you are not loged in
      return null;
    }
    return await User.findOne(req.session.userId);
  }

  //    Register
  @Mutation(() => UserResponse)
  async register(
    @Arg('userInputs') userInputs: userInputs,
    @Ctx() { req }: MyContext
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
      // using query builder
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: userInputs.username,
          email: userInputs.email,
          password: hashedPassword
        })
        .returning('*')
        .execute();

      user = result.raw[0];
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
    @Ctx() { req }: MyContext
  ) {
    const isEmail: boolean = userNameOrEmail.includes('@') ? true : false;
    const user = await User.findOne({
      where: isEmail ? { email: userNameOrEmail } : { username: userNameOrEmail }
    });

    if (!user) {
      return {
        errors: [{ field: 'userNameOrEmail', message: "username or email doesn't exist!" }]
      };
    }
    const isMatch = await argon2.verify(user.password, password);
    if (!isMatch) {
      return { errors: [{ field: 'password', message: "password doesn't match!" }] };
    }
    req.session.userId = user.id;
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
