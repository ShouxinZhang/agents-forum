import React from 'https://esm.sh/react@18.3.1';

import { ensureNodeName, splitTagsInput, tagsToInput } from '../types.ts';

const h = React.createElement;

function formFromNode(node) {
  if (!node) {
    return {
      path: '',
      parentPath: '',
      type: 'file',
      description: '',
      detail: '',
      tags: '',
    };
  }

  return {
    path: node.path ?? '',
    parentPath: node.parentPath ?? '',
    type: node.type ?? 'file',
    description: node.description ?? '',
    detail: node.detail ?? '',
    tags: tagsToInput(node.tags ?? []),
  };
}

export function NodeEditor({
  selectedNode,
  editable,
  busy,
  onSave,
  onDelete,
  onCreateChild,
}) {
  const [form, setForm] = React.useState(formFromNode(selectedNode));
  const [childName, setChildName] = React.useState('');
  const [childType, setChildType] = React.useState('file');
  const [childDescription, setChildDescription] = React.useState('');

  React.useEffect(() => {
    setForm(formFromNode(selectedNode));
    setChildName('');
    setChildType('file');
    setChildDescription('');
  }, [selectedNode]);

  const readOnly = !editable || !selectedNode;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitSave = () => {
    if (!selectedNode) return;
    onSave?.({
      path: form.path,
      parentPath: form.parentPath.trim() || null,
      type: form.type,
      description: form.description,
      detail: form.detail,
      tags: splitTagsInput(form.tags),
    });
  };

  const submitCreateChild = () => {
    if (!selectedNode) return;
    const safeName = ensureNodeName(childName);
    if (!safeName) return;
    onCreateChild?.({
      parentPath: selectedNode.path,
      path: `${selectedNode.path}/${safeName}`,
      type: childType,
      description: childDescription,
      detail: '',
      tags: [],
    });
    setChildName('');
    setChildDescription('');
  };

  return h(
    'aside',
    { className: 'node-editor' },
    h('h2', null, '节点编辑'),
    selectedNode
      ? h(
          React.Fragment,
          null,
          h('label', null, 'path'),
          h('input', {
            value: form.path,
            onChange: (evt) => updateField('path', evt.target.value),
            disabled: readOnly,
          }),
          h('label', null, 'parentPath'),
          h('input', {
            value: form.parentPath,
            placeholder: '(root)',
            onChange: (evt) => updateField('parentPath', evt.target.value),
            disabled: readOnly,
          }),
          h('label', null, 'type'),
          h(
            'select',
            {
              value: form.type,
              onChange: (evt) => updateField('type', evt.target.value),
              disabled: readOnly,
            },
            h('option', { value: 'file' }, 'file'),
            h('option', { value: 'directory' }, 'directory'),
          ),
          h('label', null, 'description'),
          h('textarea', {
            rows: 2,
            value: form.description,
            onChange: (evt) => updateField('description', evt.target.value),
            disabled: readOnly,
          }),
          h('label', null, 'detail'),
          h('textarea', {
            rows: 4,
            value: form.detail,
            onChange: (evt) => updateField('detail', evt.target.value),
            disabled: readOnly,
          }),
          h('label', null, 'tags (comma separated)'),
          h('input', {
            value: form.tags,
            onChange: (evt) => updateField('tags', evt.target.value),
            disabled: readOnly,
          }),
          h(
            'div',
            { className: 'button-row' },
            h(
              'button',
              {
                type: 'button',
                disabled: readOnly || busy,
                onClick: submitSave,
              },
              busy ? '保存中...' : '保存节点',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'danger',
                disabled: readOnly || busy,
                onClick: () => onDelete?.(selectedNode.path),
              },
              '删除子树',
            ),
          ),
          h('hr'),
          h('h3', null, '新增子节点'),
          h('label', null, 'name'),
          h('input', {
            value: childName,
            placeholder: 'new-node',
            onChange: (evt) => setChildName(evt.target.value),
            disabled: readOnly,
          }),
          h('label', null, 'type'),
          h(
            'select',
            {
              value: childType,
              onChange: (evt) => setChildType(evt.target.value),
              disabled: readOnly,
            },
            h('option', { value: 'file' }, 'file'),
            h('option', { value: 'directory' }, 'directory'),
          ),
          h('label', null, 'description'),
          h('input', {
            value: childDescription,
            onChange: (evt) => setChildDescription(evt.target.value),
            disabled: readOnly,
          }),
          h(
            'button',
            {
              type: 'button',
              disabled: readOnly || busy || !ensureNodeName(childName),
              onClick: submitCreateChild,
            },
            '创建子节点',
          ),
        )
      : h('p', { className: 'hint' }, '在画布中点击一个节点后可编辑。'),
    !editable ? h('p', { className: 'readonly-tip' }, 'JSON 模式只读，不允许编辑。') : null,
  );
}
