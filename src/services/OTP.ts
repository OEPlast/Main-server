import { randomInt } from 'crypto';
import OTP, { OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, OtpType } from '../models/OTP';
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

    // Math.random is predictable; a login code needs a cryptographic source.
    const code = randomInt(100000, 1000000).toString();
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
    // Looked up by owner and type, never by the submitted code. Querying on the code let every
    // wrong guess go uncounted, and passed a JSON operator such as `{ "$gt": 0 }` straight into
    // the query, where it matched any code.
    //
    // Every submission spends one attempt BEFORE the code is compared, in a single atomic update
    // that refuses once the limit is reached. Counting only after a wrong comparison would let a
    // burst of parallel requests all be checked against the real code before any count landed.
    const otp = await OTP.findOneAndUpdate(
      { user, type, attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (!otp) {
      const exhausted = await OTP.exists({ user, type });
      if (exhausted) {
        await OTP.deleteMany({ user, type });
        return {
          message: 'Too many incorrect attempts. Please request a new code.',
          data: null,
          code: 429,
        };
      }
      return {
        message: 'Invalid or expired OTP',
        data: null,
        code: 400,
      };
    }

    // The TTL index only sweeps about once a minute, so expiry is checked here as well.
    if (Date.now() - new Date(otp.createdAt).getTime() > OTP_EXPIRY_MINUTES * 60 * 1000) {
      await OTP.deleteOne({ _id: otp._id });
      return {
        message: 'OTP has expired',
        data: null,
        code: 400,
      };
    }

    if (String(otp.code) !== String(code).trim()) {
      return {
        message: 'Invalid or expired OTP',
        data: null,
        code: 400,
      };
    }

    // Single use. deleteOne reports whether this request is the one that consumed it, so two
    // simultaneous correct submissions cannot both succeed.
    const { deletedCount } = await OTP.deleteOne({ _id: otp._id });
    if (deletedCount === 0) {
      return {
        message: 'Invalid or expired OTP',
        data: null,
        code: 400,
      };
    }

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
