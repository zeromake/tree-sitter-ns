// , 分割的重复效果 [1,2,3], [1]
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)))
}

// , 分割的重复效果，但是不是必须的，可以支持类似 [1,2,3], []
function commaSep(rule) {
  return optional(commaSep1(rule))
}

module.exports = grammar({
  name: "ns",
  extras: $ => [/\s/],
  rules: {
    document: $ => repeat(
      choice(
        $.comment,
        $.if_expression,
        $.else_expression,
        $.command,
        $.label,
        // 使用变量渲染文本
        $.variable,
        $.array_item_expr
      )
    ),
    // 注释
    comment: $ => seq(/;.*/),
    // 常规变量名
    variable_name: $ => seq(/[a-zA-Z]/, /[0-9a-zA-Z_-]+/),
    // 标签
    label: $ => seq('*', $.variable_name),
    // 使用 int 生成其它变量
    integer_calc: $ => {
      const left_expression = choice($.integer, $.raw_integer_variable, $.array_item_expr, $.raw_array_variable);
      const op_expression = choice('+', '-', '*', '/', 'mod');
      const expression_one = seq(left_expression, op_expression, left_expression);
      return seq('(', expression_one, repeat(seq(op_expression, left_expression)),')');
    },
    integer_calc_variable: $ => prec.right(1, seq('%', $.integer_calc)),
    string_calc_variable: $ => prec.right(1, seq('$', $.integer_calc)),
    array_calc_variable: $ => prec.right(1, seq('?', $.integer_calc)),
    // 三种变量
    raw_string_variable: $ => seq('$', choice($.integer, $.variable_name)),
    raw_integer_variable: $ => seq('%', choice($.integer, $.variable_name)),
    raw_array_variable: $ => seq('?', choice($.integer, $.variable_name)),
    string_variable: $ => choice($.raw_string_variable, $.string_calc_variable),
    integer_variable: $ => choice($.raw_integer_variable, $.integer_calc_variable),
    array_variable: $ => choice($.raw_array_variable, $.array_calc_variable),
    // int string array 变量
    variable: $ => choice($.string_variable, $.integer_variable, $.array_variable),
    // 数组下标
    array_item_expr: $ => seq($.array_variable, repeat1(seq('[', $.integer, ']'))),
    // 字符串表达式
    string: $ => choice(seq('"', '"'), seq('"', $.string_content, '"')),
    string_content: $ => repeat1(choice(
      token.immediate(prec(1, /[^\\"\n]+/))
    )),
    // 数字表达式
    integer: $ => {
      const decimal_digits = /\d+/;
      const decimal_integer = seq(
        optional(choice('-', '+')),
        choice(
          '0',
          seq(/[1-9]/, optional(decimal_digits))
        )
      );
      return token(decimal_integer);
    },
    // hex 颜色
    hex_color: $ => {
      return seq('#', choice(/[0-9a-fA-F]{3}/, /[0-9a-fA-F]{4}/, /[0-9a-fA-F]{6}/, /[0-9a-fA-F]{8}/))
    },
    // 参数表达式
    expression: $ => choice(
      $.integer,
      $.string,
      $.array_item_expr,
      $.variable,
      $.variable_name,
      $.label,
      $.hex_color
    ),
    if_expression: $ => {
      const integer_if_expression = choice($.variable, $.integer, $.string);
      const op_if_expression = choice('<>', '>', '<', '>=', '<=', '==', '=', '!=');
      const if_expression_one = seq(integer_if_expression, op_if_expression, integer_if_expression);
      // 把表达式内嵌到 if 语句里
      return prec.right(1, seq(
        choice('if', 'notif', 'elseif', 'elif'),
        ' ',
        if_expression_one,
        repeat(seq(choice('||', '&&'), if_expression_one)),
        optional($.command),
      ));
    },
    else_expression: $ => prec.right(1, seq('else', optional(seq(' ', $.command)))),
    // 命令语句
    command: $ => seq(
      field("command", $.variable_name),
      prec.left(
        1,
        optional(
          choice(
            // 字符串表达式在最前面可以不用空格分割
            seq($.string, optional(seq(',', commaSep1(
              field("param", $.expression)
            )))),
            // 正常使用空格分割的参数
            seq(' ', commaSep1(
              field("param", $.expression)
            )),
          ),
        )
      ),
    )
  }
});

