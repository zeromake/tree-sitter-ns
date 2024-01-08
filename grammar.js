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
    // 三种变量
    string_variable: $ => seq('$', choice($.integer, $.variable_name)),
    integer_variable: $ => seq('%', choice($.integer, $.variable_name)),
    array_variable: $ => seq('?', choice($.integer, $.variable_name)),
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

