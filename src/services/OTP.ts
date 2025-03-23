import OTP, { OtpType } from '../models/OTP';
import { CustomResponseType } from '@/types';

/**
 * Creates a new OTP.
 * @param user - The user ID for whom the OTP is generated.
 * @param type - The type of OTP (e.g., 'reset password', 'payment').
 * @returns A promise that resolves to a custom response containing the created OTP.
 */
const createOtp = async ({
  user,
  type,
}: {
  user: string;
  type: OtpType['type'];
}): Promise<CustomResponseType<number>> => {
  try {
    //delete all pre-exiting otp of this type
    await OTP.deleteMany({ user, type });

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
    const otp = new OTP({ user, type, code });
    await otp.save();
    return {
      message: 'OTP created successfully',
      data: otp.code,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes an OTP.
 * @param user - The user ID for whom the OTP is deleted.
 * @param type - The type of OTP to delete.
 * @returns A promise that resolves to a custom response indicating the deletion status.
 */
const deleteOtp = async ({
  user,
  type,
}: {
  user: string;
  type: OtpType['type'];
}): Promise<CustomResponseType<null>> => {
  try {
    await OTP.deleteMany({ user, type });
    return {
      message: 'OTP deleted successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

/**
 * Verifies an OTP.
 * @param user - The user ID for whom the OTP is verified.
 * @param type - The type of OTP to verify.
 * @param code - The OTP code to verify.
 * @returns A promise that resolves to a custom response indicating the verification status.
 */
const verifyOtp = async ({
  user,
  type,
  code,
}: {
  user: string;
  type: OtpType['type'];
  code: OtpType['code'];
}): Promise<CustomResponseType<null>> => {
  try {
    const otp = await OTP.findOne({ user, type, code });

    if (!otp) {
      return {
        message: 'Invalid or expired OTP',
        data: null,
        code: 400,
      };
    }

    // OTP is valid, delete it after verification
    await OTP.deleteOne({ _id: otp._id });

    return {
      message: 'OTP verified successfully',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      message: 'Something went wrong',
      data: null,
      code: 500,
    };
  }
};

const OTPService = { createOtp, deleteOtp, verifyOtp };
export default OTPService;
