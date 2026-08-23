import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { updateSession } from '@/utils/supabase/middleware'
import {
    EMBED_WIDGET_PATH,
    buildFrameAncestorsDirective,
    evaluateWidgetOriginPolicy
} from '@/lib/widget/origin-policy'

const EMBED_DENIAL_BODY = 'Widget embedding is not allowed for this origin.'

function applyEmbedSecurityHeaders(response: NextResponse, frameAncestors: string) {
    response.headers.set('Content-Security-Policy', frameAncestors)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    return response
}

function denyEmbed() {
    const response = applyEmbedSecurityHeaders(
        new NextResponse(EMBED_DENIAL_BODY, { status: 403 }),
        buildFrameAncestorsDirective([])
    )
    response.headers.set('X-Frame-Options', 'DENY')
    return response
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    if (pathname === EMBED_WIDGET_PATH || pathname.startsWith(`${EMBED_WIDGET_PATH}/`)) {
        const policy = await evaluateWidgetOriginPolicy(
            request.nextUrl.searchParams.get('merchantKey'),
            request.nextUrl.searchParams.get('parentOrigin')
        )

        if (!policy.allowed) {
            return denyEmbed()
        }

        return applyEmbedSecurityHeaders(
            NextResponse.next({ request }),
            buildFrameAncestorsDirective(policy.allowedOrigins)
        )
    }

    const sessionResponse = await updateSession(request)

    const restrictedPaths = ['/customer/login', '/customer/register']

    if (restrictedPaths.some((path) => pathname.startsWith(path))) {
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET
        })

        if (token) {
            return NextResponse.redirect(new URL('/store', request.url))
        }
    }

    return sessionResponse
}

export const config = {
    matcher: ['/customer/login', '/customer/register', '/dashboard/:path*', '/login', '/auth/callback', '/embed/widget/:path*'],
}
