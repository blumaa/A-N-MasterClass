'use client';
// ActionForms bound to the Studio commerce actions.
import { ActionForm, type ActionFormProps } from '@/components/ActionForm/ActionForm';
import { editCouponAction, editOfferAction, savePaymentsAction } from '../../studioActions';

type Props = Omit<ActionFormProps, 'action'>;

export const OfferForm = (props: Props) => <ActionForm action={editOfferAction} done="Saved" {...props} />;
export const CouponForm = (props: Props) => <ActionForm action={editCouponAction} done="Saved" {...props} />;
export const PaymentsForm = (props: Props) => <ActionForm action={savePaymentsAction} done="Saved" {...props} />;
