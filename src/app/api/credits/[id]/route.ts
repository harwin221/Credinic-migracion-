
import { NextResponse } from 'next/server';
import { getCredit, updateCredit } from '@/services/credit-service-server';
import { getSession } from '@/app/(auth)/login/actions';

export async function GET(
    request: Request, 
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const credit = await getCredit(id);
        if (!credit) {
            return NextResponse.json({ error: 'Crédito no encontrado' }, { status: 404 });
        }
        return NextResponse.json(credit);
    } catch (error) {
        console.error(`[API GET /credits/[id]]`, error);
        return NextResponse.json({ error: 'Error al obtener el crédito.' }, { status: 500 });
    }
}

export async function PUT(
    request: Request, 
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const creditData = await request.json();
        const result = await updateCredit(id, creditData, session);

        if (result.success) {
            return NextResponse.json({ message: 'Crédito actualizado' });
        } else {
            return NextResponse.json({ error: result.error || 'No se pudo actualizar el crédito' }, { status: 400 });
        }
    } catch (error) {
        console.error(`[API PUT /credits/[id]]`, error);
        return NextResponse.json({ error: 'Error en el servidor al actualizar el crédito.' }, { status: 500 });
    }
}
