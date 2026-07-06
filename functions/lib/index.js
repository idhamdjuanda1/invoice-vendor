import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';
if (getApps().length === 0) {
    initializeApp();
}
const maxLogoSizeBytes = 2 * 1024 * 1024;
function requiredEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name}_MISSING`);
    return value;
}
function getR2Client() {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
            secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
        },
    });
}
function getExtension(fileName, contentType) {
    const extensionFromName = fileName.split('.').pop()?.toLowerCase();
    if (extensionFromName && ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(extensionFromName)) {
        return extensionFromName;
    }
    const extensionByType = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return extensionByType[contentType] ?? 'png';
}
function encodeObjectKey(key) {
    return key
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}
function getPublicUrl(key) {
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (publicBaseUrl)
        return `${publicBaseUrl}/${encodeObjectKey(key)}`;
    return `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${requiredEnv('R2_BUCKET_NAME')}/${encodeObjectKey(key)}`;
}
function assertLogoFile(contentType, fileSize) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(contentType)) {
        throw new Error('INVALID_LOGO_TYPE');
    }
    if (fileSize <= 0 || fileSize > maxLogoSizeBytes) {
        throw new Error('INVALID_LOGO_SIZE');
    }
}
function getErrorMessage(error) {
    const message = error instanceof Error ? error.message : '';
    const messages = {
        AUTH_REQUIRED: 'Login diperlukan untuk mengelola logo vendor.',
        INVALID_VENDOR: 'Vendor tidak valid.',
        INVALID_LOGO_TYPE: 'Format logo harus PNG, JPG, WEBP, atau SVG.',
        INVALID_LOGO_SIZE: 'Ukuran logo maksimal 2MB.',
        R2_ACCOUNT_ID_MISSING: 'R2_ACCOUNT_ID belum dikonfigurasi di Firebase Functions.',
        R2_BUCKET_NAME_MISSING: 'R2_BUCKET_NAME belum dikonfigurasi di Firebase Functions.',
        R2_ACCESS_KEY_ID_MISSING: 'R2_ACCESS_KEY_ID belum dikonfigurasi di Firebase Functions.',
        R2_SECRET_ACCESS_KEY_MISSING: 'R2_SECRET_ACCESS_KEY belum dikonfigurasi di Firebase Functions.',
    };
    return messages[message] ?? 'Logo vendor belum bisa diproses.';
}
function getAuthToken(authorizationHeader) {
    if (typeof authorizationHeader !== 'string')
        throw new Error('AUTH_REQUIRED');
    if (!authorizationHeader.startsWith('Bearer '))
        throw new Error('AUTH_REQUIRED');
    return authorizationHeader.slice(7);
}
async function deleteR2File(key) {
    if (typeof key !== 'string' || !key)
        return;
    await getR2Client().send(new DeleteObjectCommand({
        Bucket: requiredEnv('R2_BUCKET_NAME'),
        Key: key,
    }));
}
async function uploadVendorLogo(input) {
    const fileBuffer = Buffer.from(input.base64, 'base64');
    assertLogoFile(input.contentType, fileBuffer.length);
    const extension = getExtension(input.fileName, input.contentType);
    const objectKey = `vendor-logo/${input.vendorId}-${Date.now()}.${extension}`;
    await getR2Client().send(new PutObjectCommand({
        Bucket: requiredEnv('R2_BUCKET_NAME'),
        Key: objectKey,
        Body: fileBuffer,
        ContentType: input.contentType,
        Metadata: {
            vendorId: input.vendorId,
        },
    }));
    return {
        logoUrl: getPublicUrl(objectKey),
        logoKey: objectKey,
    };
}
export const vendorLogo = onRequest({
    region: 'us-central1',
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
}, async (request, response) => {
    try {
        const decodedToken = await getAuth().verifyIdToken(getAuthToken(request.headers.authorization));
        const body = (request.body ?? {});
        const vendorId = typeof body.vendorId === 'string' ? body.vendorId : '';
        if (!vendorId || vendorId !== decodedToken.uid)
            throw new Error('INVALID_VENDOR');
        if (request.method === 'POST') {
            if (typeof body.fileName !== 'string' ||
                typeof body.contentType !== 'string' ||
                typeof body.base64 !== 'string') {
                throw new Error('INVALID_LOGO_SIZE');
            }
            const result = await uploadVendorLogo({
                vendorId,
                fileName: body.fileName,
                contentType: body.contentType,
                base64: body.base64,
            });
            await deleteR2File(body.previousLogoKey).catch((error) => {
                console.error('Previous vendor logo could not be deleted from R2', error);
            });
            response.status(200).json(result);
            return;
        }
        if (request.method === 'DELETE') {
            await deleteR2File(body.logoKey);
            response.status(200).json({ ok: true });
            return;
        }
        response.status(405).json({ message: 'Method not allowed.' });
    }
    catch (error) {
        console.error('Vendor logo R2 function failed', error);
        response.status(400).json({ message: getErrorMessage(error) });
    }
});
