import dbConnect from "@/lib/dbConnect";
import UserModel from "@/model/User.model";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/helpers/sendVerificationEmail";

export async function POST(request: Request) {
	await dbConnect();

	try {
		const { username, email, password } = await request.json();
		const existedUserVerifiedByUsername = await UserModel.findOne({
			username,
			isVerified: true,
		});

		if (existedUserVerifiedByUsername) {
			return Response.json(
				{
					success: false,
					message: "Username is already taken",
				},
				{ status: 400 }
			);
		}

		const existedUserVerifiedByEmail = await UserModel.findOne({
			email,
		});
		const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

		if (existedUserVerifiedByEmail) {
			if (existedUserVerifiedByEmail.isVerified) {
				return Response.json(
					{
						success: false,
						message: "User already exists with the same email",
					},
					{ status: 400 }
				);
			} else {
				const hashedPassword = await bcrypt.hash(password, 10);
				existedUserVerifiedByEmail.password = hashedPassword;
				existedUserVerifiedByEmail.verifyCode = verifyCode;
				existedUserVerifiedByEmail.verifyCodeExpiry = new Date(
					Date.now() + 3600000
				);

				await existedUserVerifiedByEmail.save();
			}
		} else {
			const hashedPassword = await bcrypt.hash(password, 10);
			const expiryDate = new Date();
			expiryDate.setHours(expiryDate.getHours() + 1);
			const newUser = new UserModel({
				username,
				email,
				hashedPassword,
				verifyCode,
				verifyCodeExpiry: expiryDate,
				isVerified: false,
				isAcceptingMessages: true,
				messages: [],
			});
			await newUser.save();
		}

		// send verification email
		const emailResponse = await sendVerificationEmail(
			email,
			username,
			verifyCode
		);

		if (!emailResponse.success) {
			return Response.json(
				{
					success: false,
					message: emailResponse.message,
				},
				{ status: 500 }
			);
		}
		return Response.json(
			{
				success: true,
				message: "User registered successfully. Please verify your email",
			},
			{ status: 201 }
		);
	} catch (error) {
		console.log("Error registering user", error);
		return Response.json(
			{
				success: true,
				message: "Error registering user",
			},
			{ status: 500 }
		);
	}
}
