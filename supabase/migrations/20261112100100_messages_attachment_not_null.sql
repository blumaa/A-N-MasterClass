-- messages_attachment let a path through without name, type or size (null check = pass).
alter table public.messages drop constraint messages_attachment;
alter table public.messages add constraint messages_attachment check (
  (attachment_path is null and attachment_name is null and attachment_type is null and attachment_size is null)
  or (attachment_path is not null and attachment_name is not null and attachment_type is not null
      and attachment_size is not null and length(trim(attachment_name)) between 1 and 255
      and length(attachment_type) > 0 and attachment_size > 0)
);
