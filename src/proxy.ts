import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
    const sessionResponse = await updateSession(request)
    const { pathname } = request.nextUrl

    const restrictedPaths = ['/customer/login', '/customer/register']

    if (restrictedPaths.some((path) => pathname.startsWith(path))) {
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET
        })

        if (token) {
            return NextResponse.redirect(new URL('/', request.url))
        }
    }

    return sessionResponse
}

export const config = {
    matcher: ['/customer/login', '/customer/register'],
}
