import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { webEnv } from "@cutia/env/web";

function getR2Config() {
	const {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	} = webEnv;

	if (
		!R2_ACCOUNT_ID ||
		!R2_ACCESS_KEY_ID ||
		!R2_SECRET_ACCESS_KEY ||
		!R2_BUCKET_NAME ||
		!R2_PUBLIC_URL
	) {
		throw new Error(
			"R2 storage is not configured. Please set R2_* environment variables.",
		);
	}

	return {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	};
}

let cachedClient: S3Client | undefined;

function getR2Client(): S3Client {
	if (cachedClient) return cachedClient;
	const config = getR2Config();
	cachedClient = new S3Client({
		region: "auto",
		endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: config.R2_ACCESS_KEY_ID,
			secretAccessKey: config.R2_SECRET_ACCESS_KEY,
		},
		// ponytail: S3Client default maxAttempts = 3, exponential backoff
	});
	return cachedClient;
}

export async function uploadToR2({
	data,
	key,
	contentType,
}: {
	data: ArrayBuffer | Uint8Array;
	key: string;
	contentType: string;
}): Promise<string> {
	const config = getR2Config();
	const client = getR2Client();
	const body = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

	await client.send(
		new PutObjectCommand({
			Bucket: config.R2_BUCKET_NAME,
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);

	const publicUrl = config.R2_PUBLIC_URL.replace(/\/$/, "");
	return `${publicUrl}/${key}`;
}

export function generateUploadKey({ filename }: { filename: string }): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).slice(2, 10);
	const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
	return `uploads/${timestamp}-${random}-${sanitized}`;
}

export function isR2Configured(): boolean {
	const {
		R2_ACCOUNT_ID,
		R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY,
		R2_BUCKET_NAME,
		R2_PUBLIC_URL,
	} = webEnv;
	return !!(
		R2_ACCOUNT_ID &&
		R2_ACCESS_KEY_ID &&
		R2_SECRET_ACCESS_KEY &&
		R2_BUCKET_NAME &&
		R2_PUBLIC_URL
	);
}
