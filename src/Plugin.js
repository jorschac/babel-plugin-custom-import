import { join } from 'path';
import { addSideEffect, addDefault, addNamed } from '@babel/helper-module-imports';

/**
 * 驼峰 -> 分隔符
 * @param {*} _str 驼峰
 * @param {*} symbol 分隔符
 * @returns
 */
function transCamel(_str, symbol) {
  // e.g. QRCode
  // First match: QR
  // Second match: Code
  const cells = _str.match(/([A-Z]+(?=[A-Z]|$))|([A-Z]?[^A-Z]+)/g) || [];
  return cells.map(c => c.toLowerCase()).join(symbol);
}

function winPath(path) {
  return path.replace(/\\/g, '/');
}

function normalizeCustomName(originCustomName) {
  // If set to a string, treat it as a JavaScript source file path.
  if (typeof originCustomName === 'string') {
    // eslint-disable-next-line import/no-dynamic-require
    const customNameExports = require(originCustomName);
    return typeof customNameExports === 'function' ? customNameExports : customNameExports.default;
  }

  return originCustomName;
}

export default class Plugin {
  constructor(param) {
    const {
      libraryName,
      libraryDirectory,
      style,
      styleLibraryDirectory,
      customStyleName,
      camel2DashComponentName,
      camel2UnderlineComponentName,
      fileName,
      customName,
      transformToDefaultImport,
      alias,
      transferNameOn,
      types,
      index = 0,
    } = param;
    if (!types) {
      throw new Error('types不存在', { types });
    }
    /**
     * 目标包名，如antd
     */
    this.libraryName = libraryName;
    /**
     * 包里到处模块的文件夹，默认是lib
     */
    this.libraryDirectory = typeof libraryDirectory === 'undefined' ? 'lib' : libraryDirectory;
    /**
     * 驼峰是否转化为'-'分隔符，默认是true
     */
    this.camel2DashComponentName =
      typeof camel2DashComponentName === 'undefined' ? true : camel2DashComponentName;
    /**
     * 驼峰是否转化为'_'分隔符
     */
    this.camel2UnderlineComponentName = camel2UnderlineComponentName;
    /**
     * 是否导出当前组件的样式文件，不用管
     */
    this.style = style || false;
    /**
     * 导出组件的样式文件的路径，不用太管
     */
    this.styleLibraryDirectory = styleLibraryDirectory;
    /**
     * 根据导入的样式动态地决定该模块的引入路径，见 https://github.com/umijs/babel-plugin-import#customName，不用管
     */
    this.customStyleName = normalizeCustomName(customStyleName);
    this.fileName = fileName || '';
    /**
     * 根据导入的模块动态地决定该模块的引入路径，见 https://github.com/umijs/babel-plugin-import#customName
     */
    this.customName = normalizeCustomName(customName);
    /**
     * 要处理的npm包没有默认导出时设为false， 若没配置则默认是 true
     */
    this.transformToDefaultImport =
      typeof transformToDefaultImport === 'undefined' ? true : transformToDefaultImport;
    /**
     * babel的types工具包
     */
    this.types = types;
    /**
     * 每个插件实例的独立标识符
     */
    this.pluginStateKey = `importPluginState${index}`;
    /**
     * The alias for the library, if provided
     */
    this.alias = typeof alias === 'undefined' ? undefined : alias;
    /**
     * 是否根据导入的模块名转换导出文件名称，默认=true
     */
    this.transferNameOn = typeof transferNameOn === 'undefined' ? true : transferNameOn;
  }

  /**
   * 获取或初始化插件的状态对象，存储在 Babel 的 state 中。
   * @param {*} state
   * @returns
   */
  getPluginState(state) {
    if (!state[this.pluginStateKey]) {
      state[this.pluginStateKey] = {}; // eslint-disable-line
    }
    return state[this.pluginStateKey];
  }

  ProgramEnter(path, state) {
    const pluginState = this.getPluginState(state);
    // 模块名称到本地别名的映射
    pluginState.specified = Object.create(null);
    // 默认导入模块的字典
    pluginState.libraryObjs = Object.create(null);
    // 指定导入的模块到解析后的导入路径的映射
    pluginState.selectedMethods = Object.create(null);
    pluginState.pathsToRemove = [];
  }

  ProgramExit(path, state) {
    this.getPluginState(state).pathsToRemove.forEach(p => !p.removed && p.remove());
  }

  // ============================ 工具函数 ============================ //

  /**
   * 生成指定导入模块与之解析后的导入路径，以键值的形式储存在插件状态的selectedMethod下，并返回导入语句的identifier节点
   * @param {*} methodName - 引入的模块
   * @param {*} file - 当前正在处理的文件
   * @param {*} pluginState - 插件状态
   * @returns
   */
  importMethod(methodName, file, pluginState) {
    if (!pluginState.selectedMethods[methodName]) {
      const { style, libraryDirectory, alias } = this;
      let { transferNameOn } = this;
      transferNameOn = !alias && transferNameOn;
      let transformedMethodName = '';
      if (transferNameOn && methodName !== 'default') {
        transformedMethodName = this.camel2UnderlineComponentName
          ? transCamel(methodName, '_')
          : this.camel2DashComponentName
          ? transCamel(methodName, '-')
          : methodName;
      }

      const path = winPath(
        this.customName
          ? this.customName(methodName, file)
          : join(this.libraryName, libraryDirectory, transformedMethodName, this.fileName),
      );

      pluginState.selectedMethods[methodName] = 
        methodName === 'default' || this.transformToDefaultImport
          ? addDefault(file.path, path, { nameHint: methodName })
          : addNamed(file.path, methodName, path);

      if (this.customStyleName) {
        const stylePath = winPath(this.customStyleName(transformedMethodName, file));
        addSideEffect(file.path, `${stylePath}`);
      } else if (this.styleLibraryDirectory) {
        const stylePath = winPath(
          join(this.libraryName, this.styleLibraryDirectory, transformedMethodName, this.fileName),
        );
        addSideEffect(file.path, `${stylePath}`);
      } else if (style === true) {
        addSideEffect(file.path, `${path}/style`);
      } else if (style === 'css') {
        addSideEffect(file.path, `${path}/style/css`);
      } else if (typeof style === 'function') {
        const stylePath = style(path, file);
        if (stylePath) {
          addSideEffect(file.path, stylePath);
        }
      }
    }
    return { ...pluginState.selectedMethods[methodName] };
  }

  buildExpressionHandler(node, props, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { types } = this;
    const pluginState = this.getPluginState(state);
    props.forEach(prop => {
      if (!types.isIdentifier(node[prop])) return;
      if (
        pluginState.specified[node[prop].name] &&
        types.isImportSpecifier(path.scope.getBinding(node[prop].name).path)
      ) {
        node[prop] = this.importMethod(pluginState.specified[node[prop].name], file, pluginState); // eslint-disable-line
      }
    });
  }

  buildDeclaratorHandler(node, prop, path, state) {
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { types } = this;
    const pluginState = this.getPluginState(state);

    const checkScope = targetNode =>
      pluginState.specified[targetNode.name] && // eslint-disable-line
      path.scope.hasBinding(targetNode.name) && // eslint-disable-line
      path.scope.getBinding(targetNode.name).path.type === 'ImportSpecifier'; // eslint-disable-line

    if (types.isIdentifier(node[prop]) && checkScope(node[prop])) {
      node[prop] = this.importMethod(pluginState.specified[node[prop].name], file, pluginState); // eslint-disable-line
    } else if (types.isSequenceExpression(node[prop])) {
      node[prop].expressions.forEach((expressionNode, index) => {
        if (types.isIdentifier(expressionNode) && checkScope(expressionNode)) {
          node[prop].expressions[index] = this.importMethod(
            pluginState.specified[expressionNode.name],
            file,
            pluginState,
          ); // eslint-disable-line
        }
      });
    }
  }

  // ============================ 工具函数 ============================ //

  // ============================ 处理节点的函数 ============================ //

  /**
   *  无需多言
   * @param {*} path - 当前节点路径
   * @param {*} state - 插件状态
   * @returns
   */
  ImportDeclaration(path, state) {
    const { node } = path;

    // path maybe removed by prev instances.
    if (!node) return;

    const { value } = node.source;
    const { libraryName, alias } = this;
    const { types } = this;
    const pluginState = this.getPluginState(state);

    // Check if the import source matches either the libraryName or the alias
    if (value === libraryName || (alias && value.startsWith(alias))) {
      node.specifiers.forEach(spec => {
        if (types.isImportSpecifier(spec)) {
          // Named import
          pluginState.specified[spec.local.name] = spec.imported.name;
        } else if (types.isImportDefaultSpecifier(spec)) {
          // Default import
          pluginState.specified[spec.local.name] = 'default';
        } else {
          // Namespace import or other
          pluginState.libraryObjs[spec.local.name] = true;
        }
      });

      // If an alias is used, replace it with the actual libraryName
      if (alias && value.startsWith(alias)) {
        node.source.value = types.StringLiteral(value.replace(alias, libraryName));
      }

      pluginState.pathsToRemove.push(path);
    }
  }

  CallExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const { name } = node.callee;
    const { types } = this;
    const pluginState = this.getPluginState(state);

    if (types.isIdentifier(node.callee)) {
      if (pluginState.specified[name]) {
        // 替换节点的callee为转译后的导入语句
        node.callee = this.importMethod(pluginState.specified[name], file, pluginState);
      }
    }

    // 检查函数调用的参数是否也是导入的，是的话重复上述逻辑，多用于嵌套组件
    node.arguments = node.arguments.map(arg => {
      const { name: argName } = arg;
      if (
        pluginState.specified[argName] &&
        path.scope.hasBinding(argName) &&
        path.scope.getBinding(argName).path.type === 'ImportSpecifier'
      ) {
        return this.importMethod(pluginState.specified[argName], file, pluginState);
      }
      return arg;
    });
  }

  MemberExpression(path, state) {
    const { node } = path;
    const file = (path && path.hub && path.hub.file) || (state && state.file);
    const pluginState = this.getPluginState(state);

    // multiple instance check.
    if (!node.object || !node.object.name) return;

    if (pluginState.libraryObjs[node.object.name]) {
      // antd.Button -> _Button
      path.replaceWith(this.importMethod(node.property.name, file, pluginState));
    } else if (pluginState.specified[node.object.name] && path.scope.hasBinding(node.object.name)) {
      const { scope } = path.scope.getBinding(node.object.name);
      // global variable in file scope
      if (scope.path.parent.type === 'File') {
        node.object = this.importMethod(pluginState.specified[node.object.name], file, pluginState);
      }
    }
  }

  Property(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'value', path, state);
  }

  VariableDeclarator(path, state) {
    const { node } = path;
    this.buildDeclaratorHandler(node, 'init', path, state);
  }

  ArrayExpression(path, state) {
    const { node } = path;
    const props = node.elements.map((_, index) => index);
    this.buildExpressionHandler(node.elements, props, path, state);
  }

  LogicalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  ConditionalExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test', 'consequent', 'alternate'], path, state);
  }

  IfStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test'], path, state);
    this.buildExpressionHandler(node.test, ['left', 'right'], path, state);
  }

  ExpressionStatement(path, state) {
    const { node } = path;
    const { types } = this;
    if (types.isAssignmentExpression(node.expression)) {
      this.buildExpressionHandler(node.expression, ['right'], path, state);
    }
  }

  ReturnStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['argument'], path, state);
  }

  ExportDefaultDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['declaration'], path, state);
  }

  BinaryExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['left', 'right'], path, state);
  }

  NewExpression(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['callee'], path, state);

    const argumentsProps = node.arguments.map((_, index) => index);
    this.buildExpressionHandler(node.arguments, argumentsProps, path, state);
  }

  SwitchStatement(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['discriminant'], path, state);
  }

  SwitchCase(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['test'], path, state);
  }

  ClassDeclaration(path, state) {
    const { node } = path;
    this.buildExpressionHandler(node, ['superClass'], path, state);
  }

  SequenceExpression(path, state) {
    const { node } = path;

    const expressionsProps = node.expressions.map((_, index) => index);
    this.buildExpressionHandler(node.expressions, expressionsProps, path, state);
  }

  // ============================ 处理节点的函数 ============================ //
}
